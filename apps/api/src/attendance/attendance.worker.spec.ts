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

  it('throws an error and refuses to process IP_CSV_IMPORT jobs (cannot silently consume imports as reports)', async () => {
    const job = {
      data: { type: 'IP_CSV_IMPORT', csvContent: 'address\n10.0.0.1' },
    } as any;

    await expect(worker.process(job)).rejects.toThrow('Unsupported report job type: IP_CSV_IMPORT');
  });

  describe('ROUTER_INVENTORY_REPORT', () => {
    const mockWarehouses = [
      { id: 'wh-1', name: 'Cairo Central Hub', isActive: true },
      { id: 'wh-2', name: 'Alexandria Depot (Empty)', isActive: true },
    ];

    const mockRouters = [
      {
        router: {
          id: 'rtr-1',
          serialNumber: 'SN-OPTI-001',
          productId: 'prod-1',
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
          warehouseId: 'wh-1',
          externalLocation: null,
          notes: 'Tested good',
        },
        product: {
          name: 'OptiLink Router G1',
          sku: 'RTR-OPTI-G1',
          model: 'OL-G1',
        },
        physicalWarehouse: {
          id: 'wh-1',
          name: 'Cairo Central Hub',
        },
        custody: {
          id: 'assign-1',
          holderType: 'TECHNICIAN',
          assignedAt: new Date('2026-10-15T08:00:00Z'),
        },
        custodyWarehouse: null,
        custodyTechnician: {
          id: 'tech-1',
          name: 'Tarek Field',
          email: 'tarek@alfahd.local',
        },
      },
      {
        router: {
          id: 'rtr-2',
          serialNumber: 'SN-OPTI-002',
          productId: 'prod-1',
          status: 'AVAILABLE',
          physicalCondition: 'DAMAGED',
          warehouseId: 'wh-1',
          externalLocation: null,
          notes: 'Dropped during audit',
        },
        product: {
          name: 'OptiLink Router G1',
          sku: 'RTR-OPTI-G1',
          model: 'OL-G1',
        },
        physicalWarehouse: {
          id: 'wh-1',
          name: 'Cairo Central Hub',
        },
        custody: null, // Damaged in warehouse -> custody closed, no open assignment
        custodyWarehouse: null,
        custodyTechnician: null,
      },
      {
        router: {
          id: 'rtr-3',
          serialNumber: 'SN-FIBER-003',
          productId: 'prod-2',
          status: 'UNDER_REPAIR',
          physicalCondition: 'UNDER_REPAIR',
          warehouseId: null,
          externalLocation: 'Apex Electronics Repair Center',
          notes: 'RMA #4421',
        },
        product: {
          name: 'FiberPro DualBand',
          sku: 'RTR-FIBER-DB',
          model: 'FP-DB',
        },
        physicalWarehouse: null,
        custody: null,
        custodyWarehouse: null,
        custodyTechnician: null,
      },
    ];

    it('generates multi-sheet Excel report with warehouse summary (including empty warehouses) and custody details', async () => {
      let callCount = 0;
      dbMock.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Warehouses query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockWarehouses),
              }),
            }),
          };
        }
        // Routers query with joins
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    leftJoin: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue(mockRouters),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      });

      const job = {
        data: {
          type: 'ROUTER_INVENTORY_REPORT',
          params: {},
        },
      } as any;

      const result = await worker.process(job);

      expect(result.downloadUrl).toBeDefined();
      expect(result.totalRows).toBe(3);

      const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(uploadedBuffer);

      // ─── 1. Verify Sheet 1: Warehouse Summary ───────────────────────────
      const summarySheet = wb.getWorksheet('Warehouse Summary');
      expect(summarySheet).toBeDefined();

      // Row 2: Cairo Central Hub
      const cairoRow = summarySheet!.getRow(2);
      expect(cairoRow.getCell(1).value).toBe('Cairo Central Hub');
      expect(cairoRow.getCell(2).value).toBe('ACTIVE');
      expect(cairoRow.getCell(3).value).toBe(2); // Total physical devices: 2
      expect(cairoRow.getCell(4).value).toBe(1); // Usable stock: 1 (rtr-1 only; rtr-2 is damaged)
      expect(cairoRow.getCell(5).value).toBe(1); // Serviceable: 1
      expect(cairoRow.getCell(6).value).toBe(1); // Damaged: 1
      expect(cairoRow.getCell(8).value).toBe(2); // Available lifecycle: 2
      expect(cairoRow.getCell(16).value).toBe(1); // Custody Technician: 1
      expect(cairoRow.getCell(17).value).toBe(1); // Custody None: 1

      // Row 3: Alexandria Depot (Empty warehouse)
      const alexRow = summarySheet!.getRow(3);
      expect(alexRow.getCell(1).value).toBe('Alexandria Depot (Empty)');
      expect(alexRow.getCell(2).value).toBe('ACTIVE');
      expect(alexRow.getCell(3).value).toBe(0); // 0 devices
      expect(alexRow.getCell(4).value).toBe(0); // 0 usable stock
      expect(alexRow.getCell(5).value).toBe(0); // 0 serviceable

      // Row 4: External / Off-site
      const externalRow = summarySheet!.getRow(4);
      expect(externalRow.getCell(1).value).toBe('External / Off-Site Locations');
      expect(externalRow.getCell(3).value).toBe(1); // 1 device offsite
      expect(externalRow.getCell(4).value).toBe(0); // 0 usable stock offsite
      expect(externalRow.getCell(9).value).toBe(1); // Under repair: 1

      // ─── 2. Verify Sheet 2: Router Inventory Details ───────────────────
      const detailsSheet = wb.getWorksheet('Router Inventory Details');
      expect(detailsSheet).toBeDefined();

      // Row 2: rtr-1 (Cairo, Technician custody, Usable: YES)
      const rtr1Row = detailsSheet!.getRow(2);
      expect(rtr1Row.getCell(1).value).toBe('SN-OPTI-001');
      expect(rtr1Row.getCell(7).value).toBe('YES (+1)'); // Usable
      expect(rtr1Row.getCell(8).value).toBe('WAREHOUSE'); // Physical Location Type
      expect(rtr1Row.getCell(9).value).toBe('Cairo Central Hub'); // Physical Warehouse
      expect(rtr1Row.getCell(11).value).toBe('TECHNICIAN'); // Current Custody Type
      expect(rtr1Row.getCell(12).value).toBe('Tarek Field (tarek@alfahd.local)'); // Current Custody Holder

      // Row 3: rtr-2 (Cairo, No custody, Usable: NO because DAMAGED)
      const rtr2Row = detailsSheet!.getRow(3);
      expect(rtr2Row.getCell(1).value).toBe('SN-OPTI-002');
      expect(rtr2Row.getCell(6).value).toBe('DAMAGED');
      expect(rtr2Row.getCell(7).value).toBe('NO (0)');
      expect(rtr2Row.getCell(8).value).toBe('WAREHOUSE');
      expect(rtr2Row.getCell(9).value).toBe('Cairo Central Hub');
      expect(rtr2Row.getCell(11).value).toBe('NONE');
      expect(rtr2Row.getCell(12).value).toBe('-');

      // Row 4: rtr-3 (External location, Usable: NO)
      const rtr3Row = detailsSheet!.getRow(4);
      expect(rtr3Row.getCell(1).value).toBe('SN-FIBER-003');
      expect(rtr3Row.getCell(8).value).toBe('EXTERNAL');
      expect(rtr3Row.getCell(9).value).toBe('-');
      expect(rtr3Row.getCell(10).value).toBe('Apex Electronics Repair Center');
    });

    it('sanitizes formula-injection payloads in router serial, model, external location, and notes (CWE-1236)', async () => {
      const maliciousRouters = [
        {
          router: {
            id: 'rtr-inj',
            serialNumber: "=cmd|'/c calc'!A1",
            productId: 'prod-1',
            status: 'AVAILABLE',
            physicalCondition: 'SERVICEABLE',
            warehouseId: null,
            externalLocation: '=HYPERLINK("http://evil.example")',
            notes: '+1234567890',
          },
          product: {
            name: 'Injected Name',
            sku: '@SKU-INJECT',
            model: '-MODEL-INJECT',
          },
          physicalWarehouse: null,
          custody: null,
          custodyWarehouse: null,
          custodyTechnician: null,
        },
      ];

      let callCount = 0;
      dbMock.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    leftJoin: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockResolvedValue(maliciousRouters),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      });

      const job = {
        data: {
          type: 'ROUTER_INVENTORY_REPORT',
          params: {},
        },
      } as any;

      await worker.process(job);

      const uploadedBuffer = storageServiceMock.uploadFile.mock.calls[0][0];
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(uploadedBuffer);

      const detailsSheet = wb.getWorksheet('Router Inventory Details');
      const row = detailsSheet!.getRow(2);

      const serialCell = String(row.getCell(1).value);
      const skuCell = String(row.getCell(3).value);
      const modelCell = String(row.getCell(4).value);
      const extLocCell = String(row.getCell(10).value);
      const notesCell = String(row.getCell(14).value);

      expect(serialCell.startsWith("'=")).toBe(true);
      expect(skuCell.startsWith("'@")).toBe(true);
      expect(modelCell.startsWith("'-")).toBe(true);
      expect(extLocCell.startsWith("'=")).toBe(true);
      expect(notesCell.startsWith("'+")).toBe(true);
    });
  });
});
