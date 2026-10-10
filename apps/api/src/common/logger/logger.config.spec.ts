import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createPinoConfig,
  SAFE_REQUEST_ID_REGEX,
  SENSITIVE_REDACTION_PATHS,
} from './logger.config.js';

describe('createPinoConfig', () => {
  it('configures JSON logging and info level for production', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as Record<string, unknown>;

    expect(pinoHttp.level).toBe('info');
    expect(pinoHttp.transport).toBeUndefined();
    expect(typeof pinoHttp.autoLogging).toBe('object');
  });

  it('configures pino-pretty only for development', () => {
    const devConfig = createPinoConfig({ NODE_ENV: 'development' });
    const devPinoHttp = devConfig.pinoHttp as Record<string, unknown>;
    expect(devPinoHttp.level).toBe('debug');
    expect(devPinoHttp.transport).toBeDefined();

    // Guards staging and preview environments against pino-pretty crashes
    for (const env of ['staging', 'preview', 'production', 'test']) {
      const otherConfig = createPinoConfig({ NODE_ENV: env });
      const otherPinoHttp = otherConfig.pinoHttp as Record<string, unknown>;
      expect(otherPinoHttp.transport).toBeUndefined();
    }
  });

  it('configures silent level and disables autoLogging for test', () => {
    const config = createPinoConfig({ NODE_ENV: 'test' });
    const pinoHttp = config.pinoHttp as Record<string, unknown>;

    expect(pinoHttp.level).toBe('silent');
    expect(pinoHttp.autoLogging).toBe(false);
  });

  it('ignores health check endpoints in autoLogging to prevent log flooding', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as {
      autoLogging: { ignore: (req: IncomingMessage) => boolean };
    };

    expect(pinoHttp.autoLogging.ignore({ url: '/' } as IncomingMessage)).toBe(true);
    expect(pinoHttp.autoLogging.ignore({ url: '/health' } as IncomingMessage)).toBe(true);
    expect(pinoHttp.autoLogging.ignore({ url: '/health?format=json' } as IncomingMessage)).toBe(
      true,
    );
    expect(pinoHttp.autoLogging.ignore({ url: '/api/users' } as IncomingMessage)).toBe(false);
    expect(pinoHttp.autoLogging.ignore({ url: '/auth/login' } as IncomingMessage)).toBe(false);
  });

  it('includes query parameters and snake_case credentials in redaction paths', () => {
    const requiredRedactions = [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.query.token',
      'req.query.code',
      'req.query.secret',
      'req.body.password',
      'req.body.current_password',
      'req.body.new_password',
      'req.body.refresh_token',
      'req.body.access_token',
      'req.body.token',
      'req.body.national_id',
      'current_password',
      'new_password',
      'refresh_token',
      'access_token',
      '*.current_password',
      '*.new_password',
    ];

    for (const field of requiredRedactions) {
      expect(SENSITIVE_REDACTION_PATHS).toContain(field);
    }
  });

  it('generates a safe request ID when header is missing', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as {
      genReqId: (req: IncomingMessage, res: ServerResponse) => string;
    };

    const req = { headers: {} } as unknown as IncomingMessage;
    const res = { setHeader: vi.fn() } as unknown as ServerResponse;

    const reqId = pinoHttp.genReqId(req, res);

    expect(typeof reqId).toBe('string');
    expect(SAFE_REQUEST_ID_REGEX.test(reqId)).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', reqId);
  });

  it('propagates safe incoming x-request-id within 64 characters', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as {
      genReqId: (req: IncomingMessage, res: ServerResponse) => string;
    };

    const customId = 'req-abc_123-valid';
    const req = { headers: { 'x-request-id': customId } } as unknown as IncomingMessage;
    const res = { setHeader: vi.fn() } as unknown as ServerResponse;

    const reqId = pinoHttp.genReqId(req, res);

    expect(reqId).toBe(customId);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', customId);
  });

  it('rejects unsafe incoming x-request-id and generates a fresh UUID', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as {
      genReqId: (req: IncomingMessage, res: ServerResponse) => string;
    };

    const unsafeIds = [
      'id with spaces',
      'id\nwith\nnewlines',
      'id\rwith\rcrlf',
      'a'.repeat(65), // over 64 chars
      'invalid!@#$%^&*()',
      '',
    ];

    for (const unsafeId of unsafeIds) {
      const res = { setHeader: vi.fn() } as unknown as ServerResponse;
      const req = { headers: { 'x-request-id': unsafeId } } as unknown as IncomingMessage;

      const reqId = pinoHttp.genReqId(req, res);

      expect(reqId).not.toBe(unsafeId);
      expect(SAFE_REQUEST_ID_REGEX.test(reqId)).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('x-request-id', reqId);
    }
  });

  it('handles array x-request-id header properly', () => {
    const config = createPinoConfig({ NODE_ENV: 'production' });
    const pinoHttp = config.pinoHttp as {
      genReqId: (req: IncomingMessage, res: ServerResponse) => string;
    };

    const res = { setHeader: vi.fn() } as unknown as ServerResponse;
    const req = {
      headers: { 'x-request-id': ['valid-id-123', 'another-id'] },
    } as unknown as IncomingMessage;

    const reqId = pinoHttp.genReqId(req, res);
    expect(reqId).toBe('valid-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'valid-id-123');
  });
});
