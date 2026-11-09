import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stat } from 'node:fs/promises';
import { Role } from '@alfahd/types';
import * as schema from '../src/database/schema/index.js';
import { RepositoryService } from '../src/modules/repository/repository.service.js';
import { ProductsRepository } from '../src/modules/repository/repositories/products.repository.js';
import { WarehousesRepository } from '../src/modules/repository/repositories/warehouses.repository.js';
import { InventoryRepository } from '../src/modules/repository/repositories/inventory.repository.js';
import { RoutersRepository } from '../src/modules/repository/repositories/routers.repository.js';
import { IpRepository } from '../src/modules/repository/repositories/ip.repository.js';
import { IpService } from '../src/modules/ip-management/ip.service.js';
import { IpImportWorker } from '../src/modules/ip-management/ip-import.worker.js';
import { JobsService } from '../src/jobs/jobs.service.js';
import { JobsController } from '../src/jobs/jobs.controller.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import type { JwtUser } from '../src/auth/strategies/jwt.strategy.js';
import { AttendanceReportWorker } from '../src/attendance/attendance.worker.js';
import { LocalReportStorageService } from '../src/storage/local-report-storage.service.js';
import { REPORT_STORAGE } from '../src/storage/local-report-storage.service.js';
import { StorageModule } from '../src/storage/storage.module.js';

const dbUrl = process.env.INVENTORY_TEST_DATABASE_URL;
const redisUrl = process.env.IMPORT_TEST_REDIS_URL;
describe.skipIf(!dbUrl || !redisUrl)('IP import (PostgreSQL and Redis)', () => {
  const pool = new Pool({ connectionString: dbUrl });
  const db = drizzle(pool, { schema });
  const repo = new RepositoryService(
    db,
    new ProductsRepository(db),
    new WarehousesRepository(db),
    new InventoryRepository(db),
    new RoutersRepository(db),
    new IpRepository(db),
  );
  const redis = new URL(redisUrl ?? 'redis://127.0.0.1:56379');
  const connection = { host: redis.hostname, port: Number(redis.port) };
  const prefix = `acceptance-${randomUUID()}`;
  let imports: Queue;
  let reports: Queue;
  let events: QueueEvents;
  let reportEvents: QueueEvents;
  let service: IpService;
  let worker: Worker;
  let reportWorker: Worker;
  let jobs: JobsService;
  const localDirectory = join(tmpdir(), `alfahd-report-test-${randomUUID()}`);
  const local = new LocalReportStorageService(
    new ConfigService({ REPORT_STORAGE_DIR: localDirectory }),
  );
  const actorId = randomUUID();

  beforeAll(async () => {
    imports = new Queue('ip-imports', { connection, prefix });
    reports = new Queue('reports', { connection, prefix });
    events = new QueueEvents('ip-imports', { connection, prefix });
    reportEvents = new QueueEvents('reports', { connection, prefix });
    service = new IpService(repo, imports);
    const processor = new IpImportWorker(service);
    worker = new Worker('ip-imports', (job) => processor.process(job), {
      connection,
      prefix,
      concurrency: 2,
    });
    const reportProcessor = new AttendanceReportWorker(db, local);
    reportWorker = new Worker('reports', (job) => reportProcessor.process(job), {
      connection,
      prefix,
    });
    jobs = new JobsService(reports, imports, local);
    await db.insert(schema.users).values({
      id: actorId,
      email: `${actorId}@example.invalid`,
      passwordHash: 'synthetic',
      role: 'ADMIN',
    });
    await events.waitUntilReady();
    await reportEvents.waitUntilReady();
  });
  afterAll(async () => {
    await worker.close();
    await reportWorker.close();
    await events.close();
    await reportEvents.close();
    await imports.close();
    await reports.close();
    await pool.end();
  });

  it('enqueues over 1,000 rows, processes duplicates and safely scopes polling', async () => {
    // Use a fresh 100.64/10 subnet in this disposable database.
    let offset = 0;
    for (; offset < 64; offset++) {
      const used = await pool.query(
        'SELECT 1 FROM ip_addresses WHERE address <<= $1::inet LIMIT 1',
        [`100.${64 + offset}.0.0/16`],
      );
      if (!used.rowCount) break;
    }
    if (offset === 64) throw new Error('No unused synthetic subnet available');
    const addresses = Array.from(
      { length: 1001 },
      (_, i) => `100.${64 + offset}.${Math.floor(i / 256)}.${i % 256}`,
    );
    const csv = `address,notes\n${addresses.map((address) => `${address},synthetic`).join('\n')}\n${addresses[0]},duplicate\ninvalid,bad`;
    const { jobId } = await service.enqueueImportCsv(Buffer.from(csv), actorId);
    const job = await imports.getJob(jobId);
    expect(job).toBeDefined();
    const result = await job!.waitUntilFinished(events, 60000);
    expect(result).toMatchObject({ inserted: 1001, skipped: 1 });
    expect(result.errors).toEqual([
      {
        row: 1004,
        address: 'invalid',
        reason: 'Invalid IPv4 host address format (no CIDR or IPv6 allowed)',
      },
    ]);
    const admin = {
      userId: actorId,
      role: Role.ADMIN,
      email: 'admin@example.invalid',
      tokenId: 'test',
    };
    const other = {
      userId: randomUUID(),
      role: Role.TECHNICIAN,
      email: 'other@example.invalid',
      tokenId: 'test',
    };
    expect(await jobs.getJobStatus(jobId, admin)).toMatchObject({
      status: 'COMPLETED',
      inserted: 1001,
      skipped: 1,
    });
    await expect(jobs.getJobStatus(jobId, other)).rejects.toThrow();
    const retry = await service.processImportJob(csv, actorId, jobId);
    expect(retry).toEqual(result);
  }, 90000);

  it('dispatches reports and downloads actual local Excel bytes only to the requester or admin', async () => {
    const configuredStorage = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), StorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          NODE_ENV: 'test',
          REPORT_STORAGE_PROVIDER: 'local',
          REPORT_STORAGE_DIR: join(tmpdir(), 'alfahd-config-check'),
        }),
      )
      .compile();
    expect(configuredStorage.get(REPORT_STORAGE)).toBeInstanceOf(LocalReportStorageService);
    await configuredStorage.close();
    const requester = {
      userId: actorId,
      role: Role.TECHNICIAN,
      email: 'requester@example.invalid',
      tokenId: 'test',
    };
    const other = { ...requester, userId: randomUUID() };
    const admin = { ...other, role: Role.ADMIN };
    let currentUser: JwtUser = requester;
    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: jobs }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = currentUser;
          return true;
        },
      })
      .compile();
    const app = module.createNestApplication();
    await app.init();
    try {
      const warehouseId = randomUUID();
      const productId = randomUUID();
      await db
        .insert(schema.warehouses)
        .values({ id: warehouseId, name: 'Mixed report warehouse' });
      await db.insert(schema.products).values({
        id: productId,
        name: 'Report device',
        sku: productId,
        model: 'test',
        category: 'test',
      });
      await db.insert(schema.routers).values([
        {
          productId,
          warehouseId,
          serialNumber: randomUUID(),
          status: 'AVAILABLE',
          physicalCondition: 'SERVICEABLE',
        },
        {
          productId,
          warehouseId,
          serialNumber: randomUUID(),
          status: 'AVAILABLE',
          physicalCondition: 'DAMAGED',
        },
        {
          productId,
          warehouseId,
          serialNumber: randomUUID(),
          status: 'DAMAGED',
          physicalCondition: 'DAMAGED',
        },
      ]);
      const job = await reports.add('router-inventory-summary', {
        type: 'ROUTER_INVENTORY_REPORT',
        params: { warehouseId },
        requestedBy: actorId,
      });
      const reportResult = await job.waitUntilFinished(reportEvents, 30000);
      if (process.platform !== 'win32') {
        const key = reportResult.downloadUrl.slice('local-report:'.length);
        const file = await stat(join(localDirectory, key));
        expect(file.mode & 0o777).toBe(0o600);
        expect((await stat(localDirectory)).mode & 0o777).toBe(0o700);
      }
      const status = await jobs.getJobStatus(String(job.id), requester);
      expect(status.downloadUrl).toBe(`/jobs/${job.id}/download`);
      const response = await request(app.getHttpServer())
        .get(status.downloadUrl!)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(response.body);
      const summary = workbook.getWorksheet('Warehouse Summary')!;
      expect(summary.getRow(2).getCell(3).value).toBe(3);
      expect(summary.getRow(2).getCell(4).value).toBe(1);
      expect(summary.getRow(2).getCell(6).value).toBe(2);
      expect(summary.getRow(2).getCell(8).value).toBe(2);
      expect(summary.getRow(2).getCell(9).value).toBe(1);
      const emptyWarehouseId = randomUUID();
      await db
        .insert(schema.warehouses)
        .values({ id: emptyWarehouseId, name: 'Empty report warehouse' });
      const emptyJob = await reports.add('router-inventory-summary', {
        type: 'ROUTER_INVENTORY_REPORT',
        params: { warehouseId: emptyWarehouseId },
        requestedBy: actorId,
      });
      await emptyJob.waitUntilFinished(reportEvents, 30000);
      const emptyWorkbook = new ExcelJS.Workbook();
      await emptyWorkbook.xlsx.load(
        (await jobs.downloadLocalReport(String(emptyJob.id), requester)) as never,
      );
      expect(emptyWorkbook.getWorksheet('Warehouse Summary')?.getRow(2).getCell(3).value).toBe(0);
      currentUser = other;
      await request(app.getHttpServer()).get(status.downloadUrl!).expect(404);
      currentUser = admin;
      await request(app.getHttpServer()).get(status.downloadUrl!).expect(200);
      const attendance = await reports.add('attendance-summary', {
        type: 'ATTENDANCE_SUMMARY',
        params: {},
        requestedBy: actorId,
      });
      await attendance.waitUntilFinished(reportEvents, 30000);
      const attendanceWorkbook = new ExcelJS.Workbook();
      await attendanceWorkbook.xlsx.load(
        (await jobs.downloadLocalReport(String(attendance.id), admin)) as never,
      );
      expect(attendanceWorkbook.getWorksheet('Attendance Report')).toBeDefined();
      const unknown = await reports.add('unsupported', { type: 'UNKNOWN' }, { attempts: 1 });
      await expect(unknown.waitUntilFinished(reportEvents, 30000)).rejects.toThrow(
        'Unsupported report job type',
      );
    } finally {
      await app.close();
    }
  }, 60000);

  it('treats concurrent imports of the same address as one insertion and one skip', async () => {
    let address = '';
    for (let i = 0; i < 250; i++) {
      const candidate = `192.0.2.${i}`;
      if (!(await repo.ip.findByAddress(candidate))) {
        address = candidate;
        break;
      }
    }
    expect(address).not.toBe('');
    const csv = Buffer.from(`address\n${address}`);
    const [first, second] = await Promise.all([
      service.enqueueImportCsv(csv, actorId),
      service.enqueueImportCsv(csv, actorId),
    ]);
    const [firstJob, secondJob] = await Promise.all([
      imports.getJob(first.jobId),
      imports.getJob(second.jobId),
    ]);
    const [a, b] = await Promise.all([
      firstJob!.waitUntilFinished(events, 30000),
      secondJob!.waitUntilFinished(events, 30000),
    ]);
    expect(a.inserted + b.inserted).toBe(1);
    expect(a.skipped + b.skipped).toBe(1);
    const ip = await repo.ip.findByAddress(address);
    expect(
      (await repo.ip.findHistoryByIp(ip!.id)).filter((event) => event.action === 'CREATE'),
    ).toHaveLength(1);
  }, 60000);

  it('persists a safe row failure across retries without inserting history later', async () => {
    let address = '';
    for (let i = 0; i < 250; i++) {
      const candidate = `198.51.100.${i}`;
      if (!(await repo.ip.findByAddress(candidate))) {
        address = candidate;
        break;
      }
    }
    const csv = `\naddress\n\n${address}`;
    const jobId = randomUUID();
    const original = repo.ip.createHistory.bind(repo.ip);
    repo.ip.createHistory = async () => {
      throw new Error('sensitive synthetic database error');
    };
    let first;
    try {
      first = await service.processImportJob(csv, actorId, jobId);
    } finally {
      repo.ip.createHistory = original;
    }
    expect(first).toMatchObject({
      inserted: 0,
      skipped: 0,
      errors: [{ row: 4, address, reason: 'Unable to import row' }],
    });
    expect(await service.processImportJob(csv, actorId, jobId)).toEqual(first);
    expect(await repo.ip.findByAddress(address)).toBeUndefined();
  });

  it('resumes an interrupted same-job import without duplicating completed history', async () => {
    const candidates: string[] = [];
    for (let i = 0; i < 250 && candidates.length < 2; i++) {
      const candidate = `198.51.101.${i}`;
      if (!(await repo.ip.findByAddress(candidate))) candidates.push(candidate);
    }
    expect(candidates).toHaveLength(2);
    const csv = `address\n${candidates.join('\n')}`;
    const jobId = randomUUID();
    const original = repo.ip.lockImportJob.bind(repo.ip);
    let calls = 0;
    repo.ip.lockImportJob = async (id, tx) => {
      calls++;
      if (calls > 1) throw new Error('synthetic worker interruption');
      return original(id, tx);
    };
    try {
      await expect(service.processImportJob(csv, actorId, jobId)).rejects.toThrow(
        'synthetic worker interruption',
      );
    } finally {
      repo.ip.lockImportJob = original;
    }
    expect(await service.processImportJob(csv, actorId, jobId)).toMatchObject({
      inserted: 2,
      skipped: 0,
      errors: [],
    });
    const first = await repo.ip.findByAddress(candidates[0]);
    expect(
      (await repo.ip.findHistoryByIp(first!.id)).filter((event) => event.action === 'CREATE'),
    ).toHaveLength(1);
  });
});
