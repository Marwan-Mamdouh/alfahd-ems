import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { vi } from 'vitest';
import { ATTENDANCE_STATUSES, DEPARTMENTS } from '@alfahd/types';

describe('Swagger & App (e2e)', () => {
  let app: INestApplication;
  let redisClient: { ping: () => Promise<string>; quit: () => Promise<void> };

  beforeEach(async () => {
    redisClient = {
      ping: vi.fn().mockResolvedValue('PONG'),
      quit: vi.fn().mockResolvedValue('OK'),
    };

    // Override the Redis client provided by RedisModule with a stub
    // that avoids any real network connection during tests.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('REDIS_CLIENT')
      .useValue(redisClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    const config = new DocumentBuilder().setTitle('Alfahd EMS API').build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('/', app, documentFactory);

    await app.init();
  });

  it('/ (GET) returns Swagger HTML documentation', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Content-Type', /html/);
  });

  it('/-json (GET) returns Swagger OpenAPI specification with full DTO schemas', async () => {
    const res = await request(app.getHttpServer()).get('/-json').expect(200);
    expect(res.body.components.schemas).toHaveProperty('LoginRequestDto');
    expect(res.body.components.schemas.LoginRequestDto.properties).toHaveProperty('email');
    expect(res.body.components.schemas.LoginRequestDto.properties).toHaveProperty('password');
    expect(res.body.components.schemas).toHaveProperty('CreateUserRequestDto');
    expect(res.body.components.schemas.CreateUserRequestDto.properties).toHaveProperty('role');
    expect(res.body.components.schemas).toHaveProperty('UserResponseDto');
    expect(res.body.components.schemas.UserResponseDto.properties).toHaveProperty('role');
  });

  it('documents attendance list query and response schemas', async () => {
    const { body } = await request(app.getHttpServer()).get('/-json').expect(200);
    const operation = body.paths['/attendance'].get;
    const parameters = Object.fromEntries(
      operation.parameters.map((parameter: { name: string }) => [parameter.name, parameter]),
    );
    for (const [name, defaultValue, maximum] of [
      ['page', 1, 2147483647],
      ['pageSize', 20, 100],
    ] as const) {
      expect(parameters[name]).toMatchObject({
        in: 'query',
        required: false,
        schema: { type: 'integer', minimum: 1, maximum, default: defaultValue },
      });
    }
    for (const name of ['from', 'to', 'employee_id', 'department', 'status']) {
      expect(parameters[name]).toMatchObject({ in: 'query', required: false });
    }
    expect(parameters.from.schema).toMatchObject({ type: 'string', format: 'date' });
    expect(parameters.to.schema).toMatchObject({ type: 'string', format: 'date' });
    expect(parameters.employee_id.schema).toMatchObject({ type: 'string', format: 'uuid' });
    expect(parameters.department.schema).toMatchObject({ type: 'string', enum: DEPARTMENTS });
    expect(parameters.status.schema).toMatchObject({ type: 'string', enum: ATTENDANCE_STATUSES });

    const resolve = (ref: string) => {
      expect(ref).toMatch(/^#\/components\/schemas\//);
      return body.components.schemas[ref.split('/').pop()!];
    };
    const envelope = operation.responses['200'].content['application/json'].schema;
    expect(envelope.required).toContain('data');
    const list = resolve(envelope.properties.data.$ref);
    expect(list.required).toEqual(
      expect.arrayContaining(['items', 'page', 'pageSize', 'filteredTotal', 'totals']),
    );
    expect(list.properties.items.type).toBe('array');
    for (const name of ['page', 'pageSize', 'filteredTotal']) {
      expect(list.properties[name]).toMatchObject({ type: 'integer' });
    }
    const item = resolve(list.properties.items.items.$ref);
    expect(item.required).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'employeeName',
        'department',
        'workDate',
        'checkInAt',
        'checkOutAt',
        'checkInDistanceM',
        'hoursWorked',
        'status',
        'overrideReason',
        'overriddenBy',
        'overriddenAt',
      ]),
    );
    expect(item.properties.checkOutAt).toMatchObject({
      type: 'string',
      format: 'date-time',
      nullable: true,
    });
    expect(item.properties.workDate).toMatchObject({ type: 'string', format: 'date' });
    expect(item.properties.checkInAt).toMatchObject({ type: 'string', format: 'date-time' });
    expect(item.properties.status).toMatchObject({ type: 'string', enum: ATTENDANCE_STATUSES });
    expect(item.properties.department).toMatchObject({
      type: 'string',
      enum: [...DEPARTMENTS, null],
      nullable: true,
    });
    expect(item.properties.hoursWorked).toMatchObject({ type: 'number', nullable: true });
    expect(item.properties.overrideReason).toMatchObject({ type: 'string', nullable: true });
    expect(item.properties.overriddenBy).toMatchObject({
      type: 'string',
      format: 'uuid',
      nullable: true,
    });
    expect(item.properties.overriddenAt).toMatchObject({
      type: 'string',
      format: 'date-time',
      nullable: true,
    });
    const totalsProperty = list.properties.totals;
    const totals = resolve(totalsProperty.$ref ?? totalsProperty.allOf[0].$ref);
    expect(totals.required).toEqual(expect.arrayContaining(['total', 'onTime', 'late']));
    for (const name of ['total', 'onTime', 'late']) {
      expect(totals.properties[name]).toMatchObject({ type: 'integer' });
    }
  });

  it('/nonexistent (GET) returns error shape { statusCode, message, path, timestamp }', () => {
    return request(app.getHttpServer())
      .get('/nonexistent')
      .expect(404)
      .expect((res) => {
        expect(res.body).toHaveProperty('statusCode', 404);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('path', '/nonexistent');
        expect(res.body).toHaveProperty('timestamp');
        expect(typeof res.body.timestamp).toBe('string');
      });
  });

  it('Redis ping is called on startup', () => {
    // The ping was invoked during RedisModule.onModuleInit() when app.init() ran.
    expect(redisClient.ping).toHaveBeenCalledTimes(1);
  });

  it('Redis quit is called on shutdown', async () => {
    await app.close();
    expect(redisClient.quit).toHaveBeenCalledTimes(1);
  });

  afterEach(async () => {
    if (app) {
      await app.close().catch(() => {});
    }
  });
});
