import { describe, expect, it, vi, beforeAll } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { hash } from 'argon2';
import { AuthService } from './auth.service.js';
import type { Db } from '../database/database.module.js';
import type { EmailService } from '../email/email.service.js';
import type { SessionService } from '../redis/session.service.js';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { User } from '../database/schema/index.js';

/**
 * Regression tests for the non-enumeration guarantees on the recovery and login
 * paths.
 *
 * The failure mode these exist to prevent is subtle: an exception escaping
 * `forgotPassword` made the endpoint answer 500 for a registered address and 200
 * for an unknown one, which turns "reset my password" into a reliable oracle for
 * discovering which staff addresses exist. The observable contract is that the
 * HTTP response must not vary, so that is what is asserted here.
 */

const PASSWORD = 'correct-horse-battery-staple';

const ACTIVE_USER: User = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@alfahd.local',
  passwordHash: '',
  role: 'ADMIN',
  isActive: true,
  createdAt: new Date('2026-09-27T10:00:00.000Z'),
  updatedAt: new Date('2026-09-27T10:00:00.000Z'),
};

beforeAll(async () => {
  // A real argon2id hash: `verify` throws on a malformed hash rather than
  // returning false, which would mask the behaviour under test.
  ACTIVE_USER.passwordHash = await hash(PASSWORD);
});

function makeService(overrides: { rows?: User[]; send?: () => Promise<void> } = {}) {
  const rows = overrides.rows ?? [];

  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }),
  } as unknown as Db;

  const sessionService = {
    createPasswordResetToken: vi.fn().mockResolvedValue(undefined),
    consumePasswordResetToken: vi.fn(),
  } as unknown as SessionService;

  const emailService = {
    send: vi.fn(overrides.send ?? (() => Promise.resolve())),
  } as unknown as EmailService;

  const configService = {
    get: vi.fn((key: string) => (key === 'FRONTEND_URL' ? 'http://localhost:3001' : undefined)),
  } as unknown as ConfigService;

  const jwtService = { sign: vi.fn().mockReturnValue('signed.jwt.token') } as unknown as JwtService;

  const service = new AuthService(db, sessionService, jwtService, configService, emailService);

  return { service, emailService, sessionService };
}

describe('forgotPassword — must not reveal whether an account exists', () => {
  it('resolves without throwing for a registered address when delivery FAILS', async () => {
    // Regression: SMTP being down (every dev machine without MailHog, plus any
    // production mail outage) used to surface as a 500 for registered addresses
    // only, while unknown addresses got a clean 200.
    const { service } = makeService({
      rows: [ACTIVE_USER],
      send: () => Promise.reject(new Error('connect ECONNREFUSED ::1:1025')),
    });

    await expect(service.forgotPassword('admin@alfahd.local')).resolves.toBeUndefined();
  });

  it('resolves without throwing for an unregistered address', async () => {
    const { service, emailService } = makeService({ rows: [] });

    await expect(service.forgotPassword('nobody@fahdgroup.com')).resolves.toBeUndefined();

    // Unknown address: no token minted, no email attempted.
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('sends a reset link that matches the dashboard route', async () => {
    // The emailed link must equal the App Router path or the link 404s and the
    // user can never complete recovery.
    const { service, emailService } = makeService({ rows: [ACTIVE_USER] });

    await service.forgotPassword('admin@alfahd.local');

    const sent = (emailService.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      text: string;
    };

    expect(sent.text).toContain('http://localhost:3001/auth/reset-password?token=');
  });
});

describe('login — wrong password and unknown email are indistinguishable', () => {
  it('throws the same UnauthorizedException for a wrong password', async () => {
    const { service } = makeService({ rows: [ACTIVE_USER] });

    await expect(service.login('admin@alfahd.local', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws the same UnauthorizedException for an unknown address', async () => {
    const { service } = makeService({ rows: [] });

    await expect(service.login('ghost@fahdgroup.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('does not issue a session for a deactivated user', async () => {
    const { service, sessionService } = makeService({
      rows: [{ ...ACTIVE_USER, isActive: false }],
    });

    await expect(service.login('admin@alfahd.local', 'any-password')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(sessionService.createPasswordResetToken).not.toHaveBeenCalled();
  });
});
