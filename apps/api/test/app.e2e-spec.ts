import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './../src/common/interceptors/response.interceptor.js';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  it('/ (GET) returns success shape { data }', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toBe('Hello World!');
      });
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

  afterEach(async () => {
    await app.close();
  });
});
