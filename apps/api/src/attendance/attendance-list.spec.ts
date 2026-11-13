import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { AttendanceService } from './attendance.service.js';
import { AttendanceListRequestDto } from './dto/attendance-list.dto.js';
import type { Db } from '../database/database.module.js';
import type { ConfigService } from '@nestjs/config';
import type { ClockService } from '../common/services/clock.service.js';
import type { Queue } from 'bullmq';

const employeeId = '22222222-2222-4222-8222-222222222222';
const record = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: employeeId,
  workDate: '2026-10-30',
  checkInAt: new Date('2026-10-29T22:30:00Z'),
  checkOutAt: new Date('2026-10-30T06:30:00Z'),
  checkInDistanceM: 10,
  status: 'LATE',
  overrideReason: 'Correction',
  overriddenBy: employeeId,
  overriddenAt: new Date('2026-10-30T08:00:00Z'),
};

function setup(employeeExists = true) {
  const clauses: unknown[] = [];
  const offset = vi
    .fn()
    .mockResolvedValue([{ record, employeeName: 'Example', department: 'TECHNICAL' }]);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const tx = {
    select: vi.fn((fields: { id?: unknown; total?: unknown }) => ({
      from: () =>
        fields.id
          ? { where: () => ({ limit: async () => (employeeExists ? [{ id: employeeId }] : []) }) }
          : {
              innerJoin: () => ({
                where: (clause: unknown) => {
                  clauses.push(clause);
                  return fields.total
                    ? Promise.resolve([{ total: 101, onTime: 80, late: 21 }])
                    : { orderBy };
                },
              }),
            },
    })),
  };
  const db = {
    transaction: vi.fn(async (fn: (tx: unknown) => unknown, _options?: unknown) => fn(tx)),
  };
  const service = new AttendanceService(
    db as unknown as Db,
    {} as ConfigService,
    {} as ClockService,
    {} as Queue,
  );
  return { service, db, clauses, limit, offset };
}

describe('attendance list', () => {
  it('combines filters on stored work dates and maps a consistent page and contextual totals', async () => {
    const { service, db, clauses, limit, offset } = setup();
    const query = Object.assign(new AttendanceListRequestDto(), {
      from: '2026-10-30',
      to: '2026-10-31',
      employee_id: employeeId,
      department: 'TECHNICAL',
      status: 'LATE',
      page: 2,
      pageSize: 1,
    });
    const result = await service.list(query);
    expect(result).toEqual({
      items: [
        {
          ...record,
          checkInAt: record.checkInAt.toISOString(),
          checkOutAt: record.checkOutAt.toISOString(),
          overriddenAt: record.overriddenAt.toISOString(),
          employeeName: 'Example',
          department: 'TECHNICAL',
          hoursWorked: 8,
        },
      ],
      page: 2,
      pageSize: 1,
      filteredTotal: 21,
      totals: { total: 101, onTime: 80, late: 21 },
    });
    expect(db.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    });
    expect(limit).toHaveBeenCalledWith(1);
    expect(offset).toHaveBeenCalledWith(1);
    const dialect = new PgDialect();
    const base = dialect.sqlToQuery(clauses[0] as never);
    const filtered = dialect.sqlToQuery(clauses[1] as never);
    expect(base.params).toEqual(['2026-10-30', '2026-10-31', employeeId, 'TECHNICAL']);
    expect(filtered.params).toEqual([...base.params, 'LATE']);
  });

  it('returns 404 for a nonexistent employee before fetching attendance', async () => {
    const { service, clauses } = setup(false);
    await expect(
      service.list(Object.assign(new AttendanceListRequestDto(), { employee_id: employeeId })),
    ).rejects.toMatchObject({ status: 404 });
    expect(clauses).toHaveLength(0);
  });

  it('retains contextual totals on an empty page and scopes history by employee only', async () => {
    const { service, clauses, offset } = setup();
    offset.mockResolvedValueOnce([]);
    const result = await service.list(
      Object.assign(new AttendanceListRequestDto(), {
        employee_id: employeeId,
        status: 'ON_TIME',
        page: 9,
      }),
    );
    expect(result).toEqual({
      items: [],
      page: 9,
      pageSize: 20,
      filteredTotal: 80,
      totals: { total: 101, onTime: 80, late: 21 },
    });
    expect(new PgDialect().sqlToQuery(clauses[0] as never).params).toEqual([employeeId]);
  });

  it('rejects reversed date ranges', async () => {
    const { service, db } = setup();
    await expect(
      service.list(
        Object.assign(new AttendanceListRequestDto(), { from: '2026-11-02', to: '2026-11-01' }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
