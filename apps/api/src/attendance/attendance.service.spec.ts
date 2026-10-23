import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import type { User, Warehouse, AttendanceRecord } from '../database/schema/index.js';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let dbMock: any;
  let configServiceMock: any;
  let clockServiceMock: any;
  let reportsQueueMock: any;

  const mockTechnician: User = {
    id: 'tech-123',
    name: 'Tarek Technician',
    email: 'tarek@alfahd.local',
    passwordHash: 'hash',
    role: 'TECHNICIAN',
    department: 'TECHNICAL',
    phone: null,
    nationalId: null,
    hireDate: null,
    profilePhotoKey: null,
    status: 'ACTIVE',
    assignedWarehouseId: 'warehouse-123',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWarehouse: Warehouse = {
    id: 'warehouse-123',
    name: 'Cairo Main Warehouse',
    address: 'Cairo, Egypt',
    gpsLat: 30.0444,
    gpsLng: 31.2357,
    geofenceRadiusMeters: 150,
    managerId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAttendance: AttendanceRecord = {
    id: 'att-123',
    userId: 'tech-123',
    workDate: '2026-10-11',
    checkInAt: new Date('2026-10-11T06:00:00.000Z'), // 08:00 Cairo in winter (09:00 Cairo in summer)
    checkInLat: 30.0444,
    checkInLng: 31.2357,
    checkInDistanceM: 10,
    checkOutAt: null,
    status: 'ON_TIME',
    overrideReason: null,
    overriddenBy: null,
    overriddenAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    configServiceMock = {
      get: vi.fn((key: string) => {
        if (key === 'ATTENDANCE_RADIUS_M') return 150;
        if (key === 'ATTENDANCE_CUTOFF_TIME') return '09:00';
        if (key === 'APP_TIMEZONE') return 'Africa/Cairo';
        return undefined;
      }),
    };

    clockServiceMock = {
      now: vi.fn(() => new Date('2026-10-11T06:30:00.000Z')),
    };

    reportsQueueMock = {
      add: vi.fn().mockResolvedValue({ id: 'job-987' }),
    };

    dbMock = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };

    service = new AttendanceService(dbMock, configServiceMock, clockServiceMock, reportsQueueMock);
  });

  describe('checkIn', () => {
    it('rejects check-in when technician has no assigned warehouse (409)', async () => {
      const techWithoutWarehouse = { ...mockTechnician, assignedWarehouseId: null };
      dbMock.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([techWithoutWarehouse]),
          }),
        }),
      });

      await expect(service.checkIn('tech-123', 30.0444, 31.2357)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'NO_ASSIGNED_WAREHOUSE' },
      });
    });

    it('rejects check-in when distance > 150m with 400 OUT_OF_RANGE and distance in details', async () => {
      // 0.003 degrees lat ≈ 333m away
      const farLat = mockWarehouse.gpsLat! + 0.003;
      const farLng = mockWarehouse.gpsLng!;

      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              return Promise.resolve([]);
            }),
          })),
        })),
      }));

      try {
        await service.checkIn('tech-123', farLat, farLng);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(400);
        const res = httpErr.getResponse() as any;
        expect(res.code).toBe('OUT_OF_RANGE');
        expect(res.details.distanceM).toBeGreaterThan(150);
        expect(res.details.allowedRadiusM).toBe(150);
      }
    });

    it('accepts 150.04m: the rounded value reported to the client is what is enforced (HARD-06)', async () => {
      // Same-longitude offset: Haversine degenerates to R·Δφ, so choosing
      // Δlat = 150.04 / meters-per-degree yields a true distance of 150.04m.
      const M_PER_DEG = (6371000 * Math.PI) / 180;
      const edgeLat = mockWarehouse.gpsLat! + 150.04 / M_PER_DEG;

      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              return Promise.resolve([]);
            }),
          })),
        })),
      }));
      dbMock.insert.mockImplementation(() => ({
        values: vi.fn((vals) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'att-edge',
              workDate: vals.workDate,
              checkInAt: vals.checkInAt,
              checkInDistanceM: vals.checkInDistanceM,
              status: vals.status,
            },
          ]),
        })),
      }));

      // 150.04 rounds to 150.0 ≤ 150 → accepted (previously the raw float
      // 150.04 > 150 rejected while the message claimed "150m … maximum 150m").
      const res = await service.checkIn('tech-123', edgeLat, mockWarehouse.gpsLng!);
      expect(res.checkInDistanceM).toBe(150);
    });

    it('rejects 150.06m because it rounds to 150.1m — message and decision agree (HARD-06)', async () => {
      const M_PER_DEG = (6371000 * Math.PI) / 180;
      const edgeLat = mockWarehouse.gpsLat! + 150.06 / M_PER_DEG;

      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              return Promise.resolve([]);
            }),
          })),
        })),
      }));

      try {
        await service.checkIn('tech-123', edgeLat, mockWarehouse.gpsLng!);
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(400);
        const res = httpErr.getResponse() as any;
        expect(res.code).toBe('OUT_OF_RANGE');
        // The reported distance is exactly the rounded value that was compared.
        expect(res.message).toContain('150.1m');
        expect(res.details.distanceM).toBe(150.1);
      }
    });

    it('accepts check-in <= 150m and flags ON_TIME before 09:00 Cairo', async () => {
      // 05:45 UTC is 08:45 Cairo (summer DST)
      clockServiceMock.now.mockReturnValue(new Date('2026-07-15T05:45:00.000Z'));

      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              if (queryCall === 3) return Promise.resolve([]); // No existing record
              return Promise.resolve([]);
            }),
          })),
        })),
      }));

      dbMock.insert.mockImplementation(() => ({
        values: vi.fn((vals) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'att-new',
              workDate: vals.workDate,
              checkInAt: vals.checkInAt,
              checkInDistanceM: vals.checkInDistanceM,
              status: vals.status,
            },
          ]),
        })),
      }));

      const res = await service.checkIn('tech-123', mockWarehouse.gpsLat!, mockWarehouse.gpsLng!);

      expect(res.status).toBe('ON_TIME');
      expect(res.workDate).toBe('2026-07-15');
      expect(res.checkInDistanceM).toBeLessThanOrEqual(150);
    });

    it('accepts check-in <= 150m and flags LATE after 09:00 Cairo', async () => {
      // 06:15 UTC is 09:15 Cairo (summer DST)
      clockServiceMock.now.mockReturnValue(new Date('2026-07-15T06:15:00.000Z'));

      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              if (queryCall === 3) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          })),
        })),
      }));

      dbMock.insert.mockImplementation(() => ({
        values: vi.fn((vals) => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'att-late',
              workDate: vals.workDate,
              checkInAt: vals.checkInAt,
              checkInDistanceM: vals.checkInDistanceM,
              status: vals.status,
            },
          ]),
        })),
      }));

      const res = await service.checkIn('tech-123', mockWarehouse.gpsLat!, mockWarehouse.gpsLng!);

      expect(res.status).toBe('LATE');
    });

    it('rejects a second check-in on the same day with 409 ALREADY_CHECKED_IN', async () => {
      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              if (queryCall === 3) return Promise.resolve([mockAttendance]); // already checked in!
              return Promise.resolve([]);
            }),
          })),
        })),
      }));

      await expect(
        service.checkIn('tech-123', mockWarehouse.gpsLat!, mockWarehouse.gpsLng!),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ALREADY_CHECKED_IN' },
      });
    });
  });

  describe('checkOut', () => {
    it('successfully checks out without GPS requirement and computes hoursWorked', async () => {
      const checkInTime = new Date('2026-10-11T06:00:00.000Z');
      const checkOutTime = new Date('2026-10-11T14:30:00.000Z'); // 8.5 hours later
      clockServiceMock.now.mockReturnValue(checkOutTime);

      const openAttendance = { ...mockAttendance, checkInAt: checkInTime, checkOutAt: null };

      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([openAttendance]),
          })),
        })),
      }));

      dbMock.update.mockImplementation(() => ({
        set: vi.fn((vals) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                ...openAttendance,
                checkOutAt: vals.checkOutAt,
              },
            ]),
          })),
        })),
      }));

      const result = await service.checkOut('tech-123');

      expect(result.checkOutAt).toBe(checkOutTime.toISOString());
      expect(result.hoursWorked).toBe(8.5);
    });

    it('rejects check-out if no check-in exists for today (400 NO_ACTIVE_CHECK_IN)', async () => {
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      }));

      await expect(service.checkOut('tech-123')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'NO_ACTIVE_CHECK_IN' },
      });
    });

    it('returns 409 ALREADY_CHECKED_OUT when a concurrent check-out wins the race (SEC-12)', async () => {
      // Both requests observe the same open record, but the guarded UPDATE
      // (`WHERE check_out_at IS NULL`) only matches for the winner — the loser
      // sees an empty `returning()` array.
      const openAttendance = { ...mockAttendance, checkOutAt: null };

      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([openAttendance]),
          })),
        })),
      }));

      dbMock.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]), // update matched no rows
          })),
        })),
      }));

      await expect(service.checkOut('tech-123')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ALREADY_CHECKED_OUT' },
      });
    });
  });

  describe('override', () => {
    it('rejects override without reason', async () => {
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([mockAttendance]),
          })),
        })),
      }));

      await expect(
        service.override('att-123', 'admin-id', { overrideReason: '  ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully overrides attendance record with audit fields', async () => {
      const now = new Date('2026-10-11T16:00:00.000Z');
      clockServiceMock.now.mockReturnValue(now);

      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([mockAttendance]),
          })),
        })),
      }));

      dbMock.update.mockImplementation(() => ({
        set: vi.fn((vals) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                ...mockAttendance,
                status: vals.status ?? mockAttendance.status,
                overrideReason: vals.overrideReason,
                overriddenBy: vals.overriddenBy,
                overriddenAt: vals.overriddenAt,
              },
            ]),
          })),
        })),
      }));

      const res = await service.override('att-123', 'admin-1', {
        overrideReason: 'Device GPS glitch at entrance',
        status: 'ON_TIME',
      });

      expect(res.overrideReason).toBe('Device GPS glitch at entrance');
      expect(res.overriddenBy).toBe('admin-1');
      expect(res.overriddenAt).toBe(now.toISOString());
    });
  });

  describe('enqueueReport', () => {
    it('rejects date range exceeding 366 days with DATE_RANGE_EXCEEDS_MAXIMUM', async () => {
      await expect(
        service.enqueueReport(
          { from: '2025-01-01', to: '2026-02-01' }, // 396 days
          'admin-1',
        ),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'DATE_RANGE_EXCEEDS_MAXIMUM' },
      });
    });

    it('enqueues job into BullMQ and returns jobId for valid range', async () => {
      const res = await service.enqueueReport({ from: '2026-01-01', to: '2026-06-01' }, 'admin-1');

      expect(res).toEqual({ jobId: 'job-987' });
      expect(reportsQueueMock.add).toHaveBeenCalledWith(
        'attendance-summary',
        expect.objectContaining({
          type: 'ATTENDANCE_SUMMARY',
          requestedBy: 'admin-1',
        }),
        expect.objectContaining({ jobId: expect.any(String) }),
      );
    });

    it('passes a random UUID as BullMQ jobId (spec: { jobId: "<uuid>" })', async () => {
      const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      const first = await service.enqueueReport({ from: '2026-01-01', to: '2026-02-01' }, 'a1');
      const second = await service.enqueueReport({ from: '2026-01-01', to: '2026-02-01' }, 'a1');

      const firstOpts = reportsQueueMock.add.mock.calls[0][2];
      const secondOpts = reportsQueueMock.add.mock.calls[1][2];
      expect(firstOpts.jobId).toMatch(uuidV4);
      expect(secondOpts.jobId).toMatch(uuidV4);
      // Distinct ids per enqueue — no sequential, enumerable BullMQ ids.
      expect(firstOpts.jobId).not.toBe(secondOpts.jobId);
      expect(first.jobId).toBe('job-987');
      expect(second.jobId).toBe('job-987');
    });
  });

  describe('checkIn race on the unique (user_id, work_date) constraint', () => {
    const seedUpToInsert = () => {
      let queryCall = 0;
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => {
              queryCall++;
              if (queryCall === 1) return Promise.resolve([mockTechnician]);
              if (queryCall === 2) return Promise.resolve([mockWarehouse]);
              return Promise.resolve([]); // pre-insert existence check passes
            }),
          })),
        })),
      }));
    };

    it('maps a Postgres 23505 unique violation to 409 ALREADY_CHECKED_IN', async () => {
      seedUpToInsert();
      dbMock.insert.mockImplementation(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue({
            code: '23505',
            constraint: 'attendance_records_user_id_work_date_unique',
          }),
        })),
      }));

      await expect(
        service.checkIn('tech-123', mockWarehouse.gpsLat!, mockWarehouse.gpsLng!),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ALREADY_CHECKED_IN' },
      });
    });

    it('rethrows database errors that are not unique violations', async () => {
      seedUpToInsert();
      dbMock.insert.mockImplementation(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockRejectedValue(new Error('connection terminated')),
        })),
      }));

      await expect(
        service.checkIn('tech-123', mockWarehouse.gpsLat!, mockWarehouse.gpsLng!),
      ).rejects.toThrow('connection terminated');
    });
  });

  describe('override chronology validation', () => {
    const seedRecord = () => {
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([mockAttendance]),
          })),
        })),
      }));
      dbMock.update.mockImplementation(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([mockAttendance]),
          })),
        })),
      }));
    };

    it('rejects checkOutAt before checkInAt in the same payload (400)', async () => {
      seedRecord();

      await expect(
        service.override('att-123', 'admin-1', {
          overrideReason: 'trying to move time backwards',
          checkInAt: '2026-10-11T16:00:00.000Z',
          checkOutAt: '2026-10-11T14:00:00.000Z',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'CHECK_OUT_BEFORE_CHECK_IN' },
      });
      expect(dbMock.update).not.toHaveBeenCalled();
    });

    it("rejects a checkOutAt earlier than the record's existing checkInAt (400)", async () => {
      seedRecord();

      // Record check-in is 2026-10-11T06:00:00Z.
      await expect(
        service.override('att-123', 'admin-1', {
          overrideReason: 'bad adjustment',
          checkOutAt: '2026-10-11T05:00:00.000Z',
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'CHECK_OUT_BEFORE_CHECK_IN' },
      });
      expect(dbMock.update).not.toHaveBeenCalled();
    });

    it('computes hoursWorked when the override sets both times', async () => {
      const updatedRecord = { ...mockAttendance };
      dbMock.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([updatedRecord]),
          })),
        })),
      }));
      dbMock.update.mockImplementation(() => ({
        set: vi.fn((vals) => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                ...updatedRecord,
                ...(vals.checkInAt ? { checkInAt: vals.checkInAt } : {}),
                ...(vals.checkOutAt ? { checkOutAt: vals.checkOutAt } : {}),
              },
            ]),
          })),
        })),
      }));

      const res = await service.override('att-123', 'admin-1', {
        overrideReason: 'scanner downtime confirmed',
        checkInAt: '2026-10-11T06:00:00.000Z',
        checkOutAt: '2026-10-11T14:30:00.000Z',
      });

      expect(res.hoursWorked).toBe(8.5);
    });
  });
});
