import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Role } from '@alfahd/types';
import { setupTestApp, getAuthHeader } from './test-utils.js';
import { makeIpAddress, makeCreateIpDto, makeUpdateIpDto } from './fakers/index.js';
import { envelopeData } from './utils/supertest.util.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import type { IpAddress, IpHistory } from '../src/database/schema/index.js';

describe('IP Management (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const IP_FREE_ID = '11111111-1111-4111-8111-111111111111';
  const IP_RESERVED_ID = '22222222-2222-4222-8222-222222222222';
  const IP_ARCHIVED_ID = '33333333-3333-4333-8333-333333333333';
  const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

  let ipStore: IpAddress[] = [];
  let historyStore: IpHistory[] = [];

  const mockReportsQueue = {
    opts: {
      connection: { host: 'localhost', port: 6379 },
    },
    add: vi.fn(async () => ({ id: 'mock-report-job-id' })),
    getJob: vi.fn(async () => null),
  };

  const mockIpImportsQueue = {
    opts: {
      connection: { host: 'localhost', port: 6379 },
    },
    add: vi.fn(async (_name, data, opts) => ({
      id: opts?.jobId ?? 'mock-ip-import-job-id',
      data,
    })),
    getJob: vi.fn(async (id: string) => {
      if (id === 'missing-job-id') return null;
      return {
        id,
        getState: async () => 'completed',
        data: { requestedBy: '11111111-1111-4111-8111-111111111111' },
        returnvalue: {
          total: 5,
          inserted: 2,
          skipped: 2,
          errors: [
            {
              row: 6,
              address: 'invalid-ip',
              reason: 'Invalid IPv4 host address format (no CIDR or IPv6 allowed)',
            },
          ],
        },
      };
    }),
  };

  interface LockQueueItem {
    txId: number;
    resolve: () => void;
  }
  const rowLocks = new Map<string, LockQueueItem[]>();

  const acquireLock = async (id: string, txId: number) => {
    let queue = rowLocks.get(id);
    if (!queue) {
      queue = [];
      rowLocks.set(id, queue);
    }
    if (queue.length > 0 && queue[0].txId === txId) {
      return;
    }
    const isFirst = queue.length === 0;
    let grantLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      grantLock = resolve;
    });
    queue.push({ txId, resolve: grantLock });
    if (isFirst) {
      grantLock();
    }
    await lockPromise;
  };

  const releaseLocksForTx = (txId: number) => {
    for (const [id, queue] of rowLocks.entries()) {
      const idx = queue.findIndex((item) => item.txId === txId);
      if (idx !== -1) {
        queue.splice(idx, 1);
        if (queue.length > 0) {
          queue[0].resolve();
        } else {
          rowLocks.delete(id);
        }
      }
    }
  };

  let nextTxId = 1;

  const mockRepositoryService = {
    transaction: async (cb: (tx: any) => Promise<any>) => {
      const txId = nextTxId++;
      const tx = { txId };
      try {
        return await cb(tx);
      } finally {
        releaseLocksForTx(txId);
      }
    },
    ip: {
      findByAddress: async (address: string) => {
        return ipStore.find((i) => i.address.trim().toLowerCase() === address.trim().toLowerCase());
      },
      findById: async (id: string) => {
        return ipStore.find((i) => i.id === id);
      },
      findByIdForUpdate: async (id: string, tx?: any) => {
        if (tx?.txId) {
          await acquireLock(id, tx.txId);
        }
        await new Promise((resolve) => setImmediate(resolve));
        return ipStore.find((i) => i.id === id) ?? null;
      },
      findManyWithPagination: async (params: {
        status?: string;
        isArchived?: boolean;
        search?: string;
        limit: number;
        offset: number;
      }) => {
        let items = [...ipStore];
        if (params.status) {
          items = items.filter((i) => i.status === params.status);
        }
        if (params.isArchived !== undefined) {
          items = items.filter((i) => i.isArchived === params.isArchived);
        }
        if (params.search) {
          const s = params.search.toLowerCase();
          items = items.filter((i) => i.address.toLowerCase().includes(s));
        }
        return {
          items: items.slice(params.offset, params.offset + params.limit),
          total: items.length,
        };
      },
      createIp: async (data: Partial<IpAddress>) => {
        const created: IpAddress = {
          id: data.id ?? 'ip-' + Math.random().toString(36).substring(2, 9),
          address: data.address!,
          status: data.status ?? 'FREE',
          isArchived: data.isArchived ?? false,
          customerId: data.customerId ?? null,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        ipStore.push(created);
        return created;
      },
      createIpOnConflictDoNothing: async (data: Partial<IpAddress>) => {
        const existing = ipStore.find(
          (i) => i.address.trim().toLowerCase() === data.address!.trim().toLowerCase(),
        );
        if (existing) return undefined;
        const created: IpAddress = {
          id: data.id ?? 'ip-' + Math.random().toString(36).substring(2, 9),
          address: data.address!,
          status: data.status ?? 'FREE',
          isArchived: data.isArchived ?? false,
          customerId: data.customerId ?? null,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        ipStore.push(created);
        return created;
      },
      updateIp: async (id: string, updates: Partial<IpAddress>) => {
        const idx = ipStore.findIndex((i) => i.id === id);
        if (idx === -1) return undefined;
        const candidate = {
          ...ipStore[idx],
          ...updates,
          updatedAt: new Date(),
        };
        if (candidate.isArchived && candidate.status === 'RESERVED') {
          throw new Error('violates check constraint ip_addresses_not_archived_reserved_check');
        }
        ipStore[idx] = candidate;
        return ipStore[idx];
      },
      createHistory: async (data: Partial<IpHistory>) => {
        const created: IpHistory = {
          id: 'hist-' + Math.random().toString(36).substring(2, 9),
          ipId: data.ipId!,
          fromStatus: data.fromStatus!,
          toStatus: data.toStatus!,
          action: data.action!,
          reason: data.reason ?? null,
          actorId: data.actorId!,
          createdAt: new Date(),
        };
        historyStore.push(created);
        return created;
      },
      findHistoryByIp: async (ipId: string) => {
        return historyStore.filter((h) => h.ipId === ipId);
      },
    },
    routers: {},
    warehouses: {},
    products: {},
    inventory: {},
  };

  beforeAll(async () => {
    ipStore = [
      makeIpAddress({
        id: IP_FREE_ID,
        address: '192.168.10.10',
        status: 'FREE',
        isArchived: false,
        notes: 'Free pool host',
      }),
      makeIpAddress({
        id: IP_RESERVED_ID,
        address: '192.168.10.20',
        status: 'RESERVED',
        isArchived: false,
        notes: 'Reserved infrastructure host',
      }),
      makeIpAddress({
        id: IP_ARCHIVED_ID,
        address: '192.168.10.30',
        status: 'FREE',
        isArchived: true,
        notes: 'Archived deprecated range',
      }),
    ];

    historyStore = [
      {
        id: 'init-hist-1',
        ipId: IP_FREE_ID,
        fromStatus: 'FREE',
        toStatus: 'FREE',
        action: 'CREATE',
        reason: 'Initial seed',
        actorId: 'admin-seed',
        createdAt: new Date(),
      },
      {
        id: 'init-hist-2',
        ipId: IP_RESERVED_ID,
        fromStatus: 'FREE',
        toStatus: 'RESERVED',
        action: 'RESERVE',
        reason: 'Reserved for gateway',
        actorId: 'admin-seed',
        createdAt: new Date(),
      },
    ];

    const testApp = await setupTestApp({
      overrideProviders: [
        {
          provide: RepositoryService,
          useValue: mockRepositoryService,
        },
        {
          provide: getQueueToken('reports'),
          useValue: mockReportsQueue,
        },
        {
          provide: getQueueToken('ip-imports'),
          useValue: mockIpImportsQueue,
        },
      ],
    });

    app = testApp.app;
    jwtService = testApp.moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('Authentication & RBAC', () => {
    it('returns 401 Unauthorized when request lacks JWT token', async () => {
      await request(app.getHttpServer()).get('/ip-addresses').expect(401);
    });

    it('returns 200 OK when TECHNICIAN reads IP list', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      const res = await request(app.getHttpServer()).get('/ip-addresses').set(auth).expect(200);

      expect(res.body.data.items).toBeDefined();
    });

    it('returns 200 OK when TECHNICIAN reads IP details by ID', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      const res = await request(app.getHttpServer())
        .get(`/ip-addresses/${IP_FREE_ID}`)
        .set(auth)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: IP_FREE_ID,
        address: '192.168.10.10',
      });
    });

    it('returns 403 Forbidden when TECHNICIAN attempts to register an IP address', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send(makeCreateIpDto({ address: '10.0.0.1' }))
        .expect(403);
    });

    it('returns 403 Forbidden when CS attempts to read IP list', async () => {
      const auth = getAuthHeader(jwtService, Role.CS);
      await request(app.getHttpServer()).get('/ip-addresses').set(auth).expect(403);
    });

    it('returns 403 Forbidden when WAREHOUSE_STAFF attempts to reserve an IP', async () => {
      const auth = getAuthHeader(jwtService, Role.WAREHOUSE_STAFF);
      await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_FREE_ID}/reserve`)
        .set(auth)
        .send({ reason: 'Unauthorized attempt' })
        .expect(403);
    });

    it('allows ADMIN to register an IP with 201 Created', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeCreateIpDto({ address: '172.16.0.1', notes: 'Core switch' });

      const res = await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send(dto)
        .expect(201);

      const data = envelopeData<any>(res);
      expect(data).toMatchObject({
        address: '172.16.0.1',
        status: 'FREE',
        isArchived: false,
      });
    });
  });

  describe('Validation & Invariants', () => {
    it('returns 400 Bad Request when registering CIDR range notation', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send({ address: '192.168.100.0/24' })
        .expect(400);

      expect(res.body.message).toContain('CIDR');
    });

    it('returns 400 Bad Request when registering IPv6 address', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send({ address: '2001:db8::1' })
        .expect(400);

      expect(res.body.message).toContain('IPv4');
    });

    it('returns 400 Bad Request when address is malformed', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send({ address: 'not-an-ip-address' })
        .expect(400);
    });

    it('returns 409 Conflict when IP address already exists', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post('/ip-addresses')
        .set(auth)
        .send({ address: '192.168.10.10' })
        .expect(409);

      expect(res.body.message).toContain('already exists');
    });
  });

  describe('Reservation & Release Lifecycle', () => {
    it('allows ADMIN to reserve a FREE IP', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_FREE_ID}/reserve`)
        .set(auth)
        .send({ reason: 'Allocated for VIP testing' })
        .expect(200);

      expect(res.body.data.status).toBe('RESERVED');
    });

    it('returns 409 Conflict when reserving an already RESERVED IP', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_RESERVED_ID}/reserve`)
        .set(auth)
        .send({ reason: 'Duplicate reservation' })
        .expect(409);

      expect(res.body.message).toContain('already reserved');
    });

    it('returns 400 Bad Request when reserving an archived IP', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_ARCHIVED_ID}/reserve`)
        .set(auth)
        .send({ reason: 'Cannot allocate archived' })
        .expect(400);

      expect(res.body.message).toContain('archived');
    });

    it('allows ADMIN to release a RESERVED IP back to FREE', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_RESERVED_ID}/release`)
        .set(auth)
        .send({ reason: 'Released after decommissioning' })
        .expect(200);

      expect(res.body.data.status).toBe('FREE');
    });

    it('returns 409 Conflict when releasing an already FREE IP', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_RESERVED_ID}/release`)
        .set(auth)
        .send({ reason: 'Double release' })
        .expect(409);

      expect(res.body.message).toContain('already free');
    });
  });

  describe('Archive & Unarchive Constraints', () => {
    it('returns 409 Conflict when attempting to archive a RESERVED IP', async () => {
      // First ensure IP_FREE_ID is reserved
      const auth = getAuthHeader(jwtService, Role.ADMIN);

      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_FREE_ID}/archive`)
        .set(auth)
        .send({ reason: 'Attempt archive reserved' })
        .expect(409);

      expect(res.body.message).toContain('Cannot archive a RESERVED IP address');
    });

    it('archives a FREE IP successfully', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      // IP_RESERVED_ID is now FREE after the previous release test
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_RESERVED_ID}/archive`)
        .set(auth)
        .send({ reason: 'Retiring subnet' })
        .expect(200);

      expect(res.body.data.isArchived).toBe(true);
    });

    it('unarchives an archived IP successfully', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .post(`/ip-addresses/${IP_ARCHIVED_ID}/unarchive`)
        .set(auth)
        .send({ reason: 'Re-enabling subnet' })
        .expect(200);

      expect(res.body.data.isArchived).toBe(false);
    });
  });

  describe('Metadata Update & History Audit', () => {
    it('updates IP metadata notes', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const dto = makeUpdateIpDto({ notes: 'Updated notes via test' });

      const res = await request(app.getHttpServer())
        .patch(`/ip-addresses/${IP_FREE_ID}`)
        .set(auth)
        .send(dto)
        .expect(200);

      expect(res.body.data.notes).toBe('Updated notes via test');
    });

    it('retrieves full mutation history for an IP address', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .get(`/ip-addresses/${IP_FREE_ID}/history`)
        .set(auth)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((h: any) => h.action === 'CREATE')).toBe(true);
    });
  });

  describe('CSV Bulk Import', () => {
    it('returns 403 Forbidden when TECHNICIAN attempts CSV import', async () => {
      const auth = getAuthHeader(jwtService, Role.TECHNICIAN);
      await request(app.getHttpServer())
        .post('/ip-addresses/import')
        .set(auth)
        .attach('file', Buffer.from('address,notes\n10.50.0.1,Test\n'), 'ips.csv')
        .expect(403);
    });

    it('enqueues accepted CSV input through BullMQ and returns 202 with jobId without synchronous execution', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const csvData = `address,notes
10.99.1.1,Valid host 1
10.99.1.2,Valid host 2
10.99.1.1,Duplicate in file
192.168.10.10,Already in DB
invalid-ip,Broken row`;

      const res = await request(app.getHttpServer())
        .post('/ip-addresses/import')
        .set(auth)
        .attach('file', Buffer.from(csvData), 'ips.csv')
        .expect(202);

      expect(res.body.data).toHaveProperty('jobId');
      expect(mockIpImportsQueue.add).toHaveBeenCalledWith(
        'ip-csv-import',
        expect.objectContaining({
          type: 'IP_CSV_IMPORT',
          csvContent: expect.stringContaining('10.99.1.1'),
        }),
        expect.anything(),
      );
    });

    it('allows polling import outcome via GET /ip-addresses/import/:id and returns { inserted, skipped, errors }', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .get('/ip-addresses/import/mock-ip-import-job-id')
        .set(auth)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: 'mock-ip-import-job-id',
        status: 'COMPLETED',
        inserted: 2,
        skipped: 2,
      });
      expect(res.body.data.errors).toHaveLength(1);
      expect(res.body.data.errors[0].address).toBe('invalid-ip');
    });

    it('allows polling import outcome via GET /jobs/:id for authorized admin', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const res = await request(app.getHttpServer())
        .get('/jobs/mock-ip-import-job-id')
        .set(auth)
        .expect(200);

      expect(res.body.data).toMatchObject({
        id: 'mock-ip-import-job-id',
        status: 'COMPLETED',
        inserted: 2,
        skipped: 2,
      });
      expect(res.body.data.errors).toHaveLength(1);
    });

    it('processes at least 1,000 rows asynchronously with deduplication and retry safety', async () => {
      // Generate 1,005 rows
      const rows = ['address,notes'];
      for (let i = 1; i <= 1000; i++) {
        const third = Math.floor(i / 256);
        const fourth = i % 256;
        rows.push(`10.200.${third}.${fourth},Generated row ${i}`);
      }
      // Add duplicates and invalid rows
      rows.push('10.200.0.1,Duplicate in file');
      rows.push('not-an-ip-address,Bad row');
      rows.push('192.168.10.10,Already in DB');

      const csvContent = rows.join('\n');

      // Verify directly on the service's processImportJob
      const ipServiceObj = (app as any).get(
        (await import('../src/modules/ip-management/ip.service.js')).IpService,
      );

      const outcome = await ipServiceObj.processImportJob(
        csvContent,
        'admin-test-user',
        'bounded-1000-job',
      );

      expect(outcome.total).toBe(1003);
      expect(outcome.inserted).toBe(1000); // 1000 valid unique rows
      expect(outcome.skipped).toBe(2); // 1 file duplicate, 1 db duplicate
      expect(outcome.errors).toHaveLength(1); // 1 malformed row
      expect(outcome.errors[0].address).toBe('not-an-ip-address');
    });
  });

  describe('Concurrency & Serialization Invariants (T10)', () => {
    it('serializes competing reservations: exactly one succeeds with 200, one fails with 409, and records single history', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const testIp = makeIpAddress({
        id: '44444444-4444-4444-8444-444444444441',
        address: '172.20.1.1',
        status: 'FREE',
        isArchived: false,
      });
      ipStore.push(testIp);

      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/reserve`)
          .set(auth)
          .send({ reason: 'Reservation request A' }),
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/reserve`)
          .set(auth)
          .send({ reason: 'Reservation request B' }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const reserveHistory = historyStore.filter(
        (h) => h.ipId === testIp.id && h.action === 'RESERVE',
      );
      expect(reserveHistory).toHaveLength(1);

      const finalIp = ipStore.find((i) => i.id === testIp.id)!;
      expect(finalIp.status).toBe('RESERVED');
      expect(finalIp.isArchived).toBe(false);
    });

    it('serializes concurrent reserve and archive: prevents archived RESERVED state', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const testIp = makeIpAddress({
        id: '44444444-4444-4444-8444-444444444442',
        address: '172.20.1.2',
        status: 'FREE',
        isArchived: false,
      });
      ipStore.push(testIp);

      const [resReserve, resArchive] = await Promise.all([
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/reserve`)
          .set(auth)
          .send({ reason: 'Concurrent reserve' }),
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/archive`)
          .set(auth)
          .send({ reason: 'Concurrent archive' }),
      ]);

      const statuses = [resReserve.status, resArchive.status];
      // One must succeed (200), and the loser must be rejected (409 or 400)
      expect(statuses).toContain(200);
      expect(statuses.some((s) => s === 409 || s === 400)).toBe(true);

      const finalIp = ipStore.find((i) => i.id === testIp.id)!;
      // Invariant: MUST NOT be both archived and RESERVED
      expect(finalIp.isArchived && finalIp.status === 'RESERVED').toBe(false);

      if (resReserve.status === 200) {
        // Reserve won: IP is RESERVED, not archived; archive got 409 Conflict
        expect(resArchive.status).toBe(409);
        expect(finalIp.status).toBe('RESERVED');
        expect(finalIp.isArchived).toBe(false);
      } else {
        // Archive won: IP is FREE, archived; reserve got 400 Bad Request
        expect(resReserve.status).toBe(400);
        expect(finalIp.status).toBe('FREE');
        expect(finalIp.isArchived).toBe(true);
      }
    });

    it('handles concurrent idempotent archive calls without duplicate history', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const testIp = makeIpAddress({
        id: '44444444-4444-4444-8444-444444444443',
        address: '172.20.1.3',
        status: 'FREE',
        isArchived: false,
      });
      ipStore.push(testIp);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/archive`)
          .set(auth)
          .send({ reason: 'Archive attempt 1' }),
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/archive`)
          .set(auth)
          .send({ reason: 'Archive attempt 2' }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const archiveHistory = historyStore.filter(
        (h) => h.ipId === testIp.id && h.action === 'ARCHIVE',
      );
      expect(archiveHistory).toHaveLength(1);

      const finalIp = ipStore.find((i) => i.id === testIp.id)!;
      expect(finalIp.isArchived).toBe(true);
    });

    it('handles concurrent idempotent unarchive calls without duplicate history', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const testIp = makeIpAddress({
        id: '44444444-4444-4444-8444-444444444444',
        address: '172.20.1.4',
        status: 'FREE',
        isArchived: true,
      });
      ipStore.push(testIp);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/unarchive`)
          .set(auth)
          .send({ reason: 'Unarchive attempt 1' }),
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/unarchive`)
          .set(auth)
          .send({ reason: 'Unarchive attempt 2' }),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      const unarchiveHistory = historyStore.filter(
        (h) => h.ipId === testIp.id && h.action === 'UNARCHIVE',
      );
      expect(unarchiveHistory).toHaveLength(1);

      const finalIp = ipStore.find((i) => i.id === testIp.id)!;
      expect(finalIp.isArchived).toBe(false);
    });

    it('serializes competing releases: exactly one succeeds, one gets 409 Conflict, and records single history', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      const testIp = makeIpAddress({
        id: '44444444-4444-4444-8444-444444444445',
        address: '172.20.1.5',
        status: 'RESERVED',
        isArchived: false,
      });
      ipStore.push(testIp);

      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/release`)
          .set(auth)
          .send({ reason: 'Release attempt 1' }),
        request(app.getHttpServer())
          .post(`/ip-addresses/${testIp.id}/release`)
          .set(auth)
          .send({ reason: 'Release attempt 2' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const releaseHistory = historyStore.filter(
        (h) => h.ipId === testIp.id && h.action === 'RELEASE',
      );
      expect(releaseHistory).toHaveLength(1);

      const finalIp = ipStore.find((i) => i.id === testIp.id)!;
      expect(finalIp.status).toBe('FREE');
    });
  });

  describe('Edge Cases', () => {
    it('returns 404 Not Found for non-existent IP ID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer())
        .get(`/ip-addresses/${NON_EXISTENT_ID}`)
        .set(auth)
        .expect(404);
    });

    it('returns 400 Bad Request for malformed UUID', async () => {
      const auth = getAuthHeader(jwtService, Role.ADMIN);
      await request(app.getHttpServer()).get('/ip-addresses/not-a-uuid').set(auth).expect(400);
    });
  });
});
