import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import ExcelJS from 'exceljs';

const dbUrl = process.env.INVENTORY_TEST_DATABASE_URL;
const redisUrl = process.env.IMPORT_TEST_REDIS_URL;
describe.skipIf(!dbUrl || !redisUrl)('Nest workers and real authentication', () => {
  let app: INestApplication;
  const pool = new Pool({ connectionString: dbUrl });
  const actorId = randomUUID();
  const otherId = randomUUID();
  const secret = 'acceptance-only-secret-at-least-32-characters';
  let adminToken: string;
  let technicianToken: string;

  beforeAll(async () => {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DATABASE_URL: dbUrl!,
      REDIS_URL: redisUrl!,
      JWT_ACCESS_SECRET: secret,
      JWT_REFRESH_SECRET: secret,
      EMAIL_PROVIDER: 'smtp',
      EMAIL_FROM: 'synthetic@example.invalid',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_USER: 'test',
      SMTP_PASS: 'test',
      REPORT_STORAGE_PROVIDER: 'local',
      REPORT_STORAGE_DIR: join(tmpdir(), `alfahd-stack-${randomUUID()}`),
    });
    const { AppModule } = await import('../src/app.module.js');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await pool.query(
      "INSERT INTO users(id, email, password_hash, role) VALUES ($1,$2,'synthetic','ADMIN')",
      [actorId, `${actorId}@example.invalid`],
    );
    const jwt = app.get(JwtService);
    adminToken = jwt.sign(
      { sub: actorId, role: 'ADMIN', email: `${actorId}@example.invalid`, jti: randomUUID() },
      { secret },
    );
    technicianToken = jwt.sign(
      { sub: otherId, role: 'TECHNICIAN', email: `${otherId}@example.invalid`, jti: randomUUID() },
      { secret },
    );
  }, 60000);
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });

  it('enqueues and downloads a report through actual Nest workers and JWT guards', async () => {
    const submitted = await request(app.getHttpServer())
      .post('/routers/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    const jobId = submitted.body.jobId;
    expect(jobId).toBeTruthy();
    let status: any;
    for (let i = 0; i < 150; i++) {
      status = (
        await request(app.getHttpServer())
          .get(`/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      ).body;
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(status.status).toBe('COMPLETED');
    await request(app.getHttpServer()).get(status.downloadUrl).expect(401);
    await request(app.getHttpServer())
      .get(status.downloadUrl)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(404);
    const download = await request(app.getHttpServer())
      .get(status.downloadUrl)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(download.body);
    expect(workbook.getWorksheet('Warehouse Summary')).toBeDefined();

    // Exercise the dashboard's real /api rewrite with the same bearer token.
    await app.listen(0, '127.0.0.1');
    const apiAddress = app.getHttpServer().address();
    process.env.API_URL = `http://127.0.0.1:${apiAddress.port}`;
    const webDir = resolve(process.cwd(), '../web');
    const webRequire = createRequire(join(webDir, 'package.json'));
    const next = webRequire('next');
    const dashboard = next({ dev: true, dir: webDir, hostname: '127.0.0.1' });
    await dashboard.prepare();
    const server = createServer(dashboard.getRequestHandler());
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No dashboard TCP address');
      const viaDashboard = await fetch(
        `http://127.0.0.1:${address.port}/api${status.downloadUrl}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          redirect: 'manual',
        },
      );
      expect(viaDashboard.status).toBe(200);
      const proxiedWorkbook = new ExcelJS.Workbook();
      await proxiedWorkbook.xlsx.load(Buffer.from(await viaDashboard.arrayBuffer()) as never);
      expect(proxiedWorkbook.getWorksheet('Warehouse Summary')).toBeDefined();
    } finally {
      await new Promise<void>((resolveClose, reject) =>
        server.close((error) => (error ? reject(error) : resolveClose())),
      );
      await dashboard.close();
    }
  }, 60000);

  it('enqueues an import through the Nest controller and worker with JWT-scoped polling', async () => {
    let address = '';
    for (let i = 0; i < 250; i++) {
      const candidate = `203.0.113.${i}`;
      const existing = await pool.query('SELECT 1 FROM ip_addresses WHERE address = $1::inet', [
        candidate,
      ]);
      if (!existing.rowCount) {
        address = candidate;
        break;
      }
    }
    expect(address).not.toBe('');
    const submission = await request(app.getHttpServer())
      .post('/ip-addresses/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(`address\n${address}`), 'test.csv')
      .expect(202);
    const jobId = submission.body.jobId;
    await request(app.getHttpServer())
      .get(`/jobs/${jobId}`)
      .set('Authorization', `Bearer ${technicianToken}`)
      .expect(404);
    let status: any;
    for (let i = 0; i < 150; i++) {
      status = (
        await request(app.getHttpServer())
          .get(`/jobs/${jobId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      ).body;
      if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(status).toMatchObject({ status: 'COMPLETED', inserted: 1, skipped: 0, errors: [] });
  }, 60000);
});
