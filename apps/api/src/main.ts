import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { corsOrigins } from './config/refresh-cookie.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  // Required to read the refresh cookie on POST /auth/refresh.
  app.use(cookieParser());

  // The web dashboard is same-origin with this API through the Next.js
  // `/api/*` rewrite, so credentialed CORS is not needed for it. CORS with an
  // explicit allowlist remains for the mobile app and direct API consumers
  // (FR-017). A wildcard is rejected by browsers on credentialed requests,
  // which would block the cookie entirely.
  app.enableCors({
    origin: corsOrigins({
      CORS_ORIGINS: configService.get<string>('CORS_ORIGINS'),
      FRONTEND_URL: configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001',
    }),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  await app.listen(port);
}
await bootstrap();
