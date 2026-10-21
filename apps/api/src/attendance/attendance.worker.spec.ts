import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { AttendanceReportWorker } from './attendance.worker.js';

/**
 * Extracts the underlying Postgres column name from a drizzle `asc(...)`
 * expression by walking its SQL chunk tree (e.g. `asc(attendanceRecords.workDate)`
 * → `'work_date'`).
 */
function firstColumnName(node: unknown): string | undefined {
  const names: string[] = [];
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const candidate = n as { name?: unknown; queryChunks?: unknown };
    if (typeof candidate.name === 'string' && n.constructor?.name?.startsWith('Pg') === true) {
      names.push(candidate.name);
    }
    if (Array.isArray(candidate.queryChunks)) walk(candidate.queryChunks);
  };
  walk(node);
  return names[0];
}

describe('AttendanceReportWorker', () => {
  let worker: AttendanceReportWorker;
  let dbMock: any;
  let storageServiceMock: any;

  beforeEach(() => {
    dbMock = {
      select: vi.fn(),
    };

    storageServiceMock = {
      uploadFile: vi.fn().mockResolvedValue({
        publicId: 'reports/rep-123',
        url: 'https://cdn.example.com/reports/attendance.xlsx',
      }),
    };

    worker = new AttendanceReportWorker(dbMock, storageServiceMock);
  });

  it('generates an excel workbook, uploads it, and returns downloadUrl and totalRows', async () => {
    const mockRows = [
      {
        record: {
          id: 'rec-1',
          userId: 'user-1',
          workDate: '2026-10-11',
          checkInAt: new Date('2026-10-11T06:00:00Z'),
          checkOutAt: new Date('2026-10-11T14:30:00Z'),
          checkInDistanceM: 45.5,
          status: 'ON_TIME',
          overrideReason: null,
        },
        user: {
          id: 'user-1',
          name: 'Ahmed Mostafa',
          email: 'ahmed@alfahd.local',
          department: 'TECHNICAL',
        },
      },
    ];

    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }),
    });

    const job = {
      data: {
        type: 'ATTENDANCE_SUMMARY',
        params: {
          from: '2026-10-01',
          to: '2026-10-31',
        },
      },
    } as any;

    const result = await worker.process(job);

    expect(result.downloadUrl).toBe('https://cdn.example.com/reports/attendance.xlsx');
    expect(result.totalRows).toBe(1);
    expect(storageServiceMock.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      'reports',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    // Verify uploaded buffer is a valid Excel workbook
    const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(uploadedBuffer);
    const sheet = wb.getWorksheet('Attendance Report');
    expect(sheet).toBeDefined();
    expect(sheet?.rowCount).toBe(2); // header + 1 data row
    const row2 = sheet?.getRow(2);
    expect(row2?.getCell(1).value).toBe('Ahmed Mostafa');
    expect(row2?.getCell(7).value).toBe('8.50'); // shared calculateHoursWorked helper
    expect(row2?.getCell(8).value).toBe('ON_TIME');
    // Null override reason renders as a literal "-" placeholder, never `''-`
    expect(row2?.getCell(10).value).toBe('-');
    // HARD-09: Cairo wall-clock (UTC+3 in October), not raw UTC ISO strings —
    // 06:00Z/14:30Z render as the 09:00/17:30 shift staff actually work.
    expect(row2?.getCell(5).value).toBe('11/10/2026, 09:00:00');
    expect(row2?.getCell(6).value).toBe('11/10/2026, 17:30:00');
    expect(String(row2?.getCell(5).value)).not.toContain('Z');
  });

  it('pushes the department filter into SQL instead of filtering rows in memory', async () => {
    const mockRows = [
      {
        record: {
          id: 'rec-1',
          userId: 'user-1',
          workDate: '2026-10-11',
          checkInAt: new Date('2026-10-11T06:00:00Z'),
          checkOutAt: null,
          checkInDistanceM: 10,
          status: 'ON_TIME',
          overrideReason: null,
        },
        user: {
          id: 'user-1',
          name: 'Ahmed Tech',
          email: 'tech@alfahd.local',
          department: 'TECHNICAL',
        },
      },
    ];

    let whereArg: unknown;
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn((clause: unknown) => {
            whereArg = clause;
            return {
              orderBy: vi.fn().mockResolvedValue(mockRows), // SQL already filtered by department
            };
          }),
        }),
      }),
    });

    const job = {
      data: {
        type: 'ATTENDANCE_SUMMARY',
        params: {
          from: '2026-10-01',
          to: '2026-10-31',
          department: 'TECHNICAL',
        },
      },
    } as any;

    const result = await worker.process(job);

    // The department condition must reach the query, not a Node-side .filter().
    expect(whereArg).toBeDefined();
    expect(result.totalRows).toBe(1);
    const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(uploadedBuffer);
    const sheet = wb.getWorksheet('Attendance Report');
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getRow(2).getCell(1).value).toBe('Ahmed Tech');
  });

  it('sanitizes formula-injection payloads in name and override cells (CWE-1236)', async () => {
    const mockRows = [
      {
        record: {
          id: 'rec-1',
          userId: 'user-1',
          workDate: '2026-10-11',
          checkInAt: new Date('2026-10-11T06:00:00Z'),
          checkOutAt: null,
          checkInDistanceM: 10,
          status: 'ON_TIME',
          overrideReason: '=HYPERLINK("http://evil.example","click")',
        },
        user: {
          id: 'user-1',
          name: "=cmd|'/c calc'!A1",
          email: 'inject@alfahd.local',
          department: null,
        },
      },
    ];

    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }),
    });

    const job = {
      data: { type: 'ATTENDANCE_SUMMARY', params: { from: '2026-10-01', to: '2026-10-31' } },
    } as any;

    await worker.process(job);

    const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(uploadedBuffer);
    const sheet = wb.getWorksheet('Attendance Report');
    const row = sheet?.getRow(2);
    const nameCell = String(row?.getCell(1).value);
    const overrideCell = String(row?.getCell(10).value);

    expect(nameCell.startsWith("'=")).toBe(true);
    expect(overrideCell.startsWith("'=")).toBe(true);
    expect(nameCell).not.toMatch(/^=/);
    expect(overrideCell).not.toMatch(/^=/);
    // A null department renders the plain "-" placeholder, never `''-`
    expect(row?.getCell(3).value).toBe('-');
  });

  it('orders report rows deterministically by work date, name, and check-in time (SIMP-08)', async () => {
    const mockRows: unknown[] = [];
    let orderByArgs: unknown[] = [];
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn((...args: unknown[]) => {
              orderByArgs = args;
              return Promise.resolve(mockRows);
            }),
          }),
        }),
      }),
    });

    const job = {
      data: { type: 'ATTENDANCE_SUMMARY', params: { from: '2026-10-01', to: '2026-10-31' } },
    } as any;

    await worker.process(job);

    expect(orderByArgs).toHaveLength(3);
    expect(orderByArgs.map((arg) => firstColumnName(arg))).toEqual([
      'work_date',
      'name',
      'check_in_at',
    ]);
  });
});
