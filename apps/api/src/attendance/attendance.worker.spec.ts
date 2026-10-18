import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import { AttendanceReportWorker } from './attendance.worker.js';

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
          where: vi.fn().mockResolvedValue(mockRows),
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
    expect(row2?.getCell(8).value).toBe('ON_TIME');
  });

  it('filters by department when department parameter is provided', async () => {
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
      {
        record: {
          id: 'rec-2',
          userId: 'user-2',
          workDate: '2026-10-11',
          checkInAt: new Date('2026-10-11T06:00:00Z'),
          checkOutAt: null,
          checkInDistanceM: 20,
          status: 'ON_TIME',
          overrideReason: null,
        },
        user: {
          id: 'user-2',
          name: 'Sara CS',
          email: 'cs@alfahd.local',
          department: 'CUSTOMER_SERVICE',
        },
      },
    ];

    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockRows),
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

    expect(result.totalRows).toBe(1);
    const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(uploadedBuffer);
    const sheet = wb.getWorksheet('Attendance Report');
    expect(sheet?.rowCount).toBe(2);
    expect(sheet?.getRow(2).getCell(1).value).toBe('Ahmed Tech');
  });
});
