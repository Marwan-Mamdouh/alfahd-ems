import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export const SENSITIVE_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.query.token',
  'req.query.code',
  'req.query.secret',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.current_password',
  'req.body.new_password',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.refresh_token',
  'req.body.accessToken',
  'req.body.access_token',
  'req.body.national_id',
  'req.body.nationalId',
  'password',
  'currentPassword',
  'newPassword',
  'current_password',
  'new_password',
  'token',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'access_token',
  'authorization',
  'cookie',
  'national_id',
  '*.password',
  '*.*.password',
  '*.current_password',
  '*.*.current_password',
  '*.new_password',
  '*.*.new_password',
  '*.token',
  '*.*.token',
  '*.refreshToken',
  '*.*.refreshToken',
  '*.refresh_token',
  '*.*.refresh_token',
  '*.authorization',
  '*.cookie',
  '*.national_id',
  '*.*.national_id',
];

export function createPinoConfig(env: { NODE_ENV?: string }): Params {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const isDevelopment = nodeEnv === 'development';

  return {
    pinoHttp: {
      level: isTest ? 'silent' : isProduction ? 'info' : 'debug',
      autoLogging: isTest
        ? false
        : {
            ignore: (req: IncomingMessage) => {
              const url = req.url ? req.url.split('?')[0] : '';
              return url === '/' || url === '/health';
            },
          },
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers['x-request-id'];
        const candidate = Array.isArray(existing) ? existing[0] : existing;
        const id =
          typeof candidate === 'string' && SAFE_REQUEST_ID_REGEX.test(candidate)
            ? candidate
            : randomUUID();

        if (typeof res.setHeader === 'function') {
          res.setHeader('x-request-id', id);
        }
        return id;
      },
      redact: {
        paths: SENSITIVE_REDACTION_PATHS,
        censor: '[REDACTED]',
      },
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
            },
          }
        : undefined,
    },
  };
}
