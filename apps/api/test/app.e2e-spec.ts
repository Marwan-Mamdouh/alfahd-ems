import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';
import { vi } from 'vitest';

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
    app = null as any;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
