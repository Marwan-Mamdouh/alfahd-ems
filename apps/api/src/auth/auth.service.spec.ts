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
  name: 'Admin',
  email: 'admin@alfahd.local',
  passwordHash: '',
  role: 'ADMIN',
  department: null,
  phone: null,
  nationalId: null,
  hireDate: null,
  profilePhotoKey: null,
  status: 'ACTIVE',
  assignedWarehouseId: null,
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
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
  } as unknown as Db;

  const sessionService = {
    createSession: vi.fn().mockResolvedValue(undefined),
    createPasswordResetToken: vi.fn().mockResolvedValue(undefined),
    consumePasswordResetToken: vi.fn(),
    revokeAllSessions: vi.fn().mockResolvedValue(0),
    findSessionByTokenId: vi.fn().mockResolvedValue(null),
    getRevokedTokenUserId: vi.fn().mockResolvedValue(null),
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

describe('resetPassword — revokes live sessions (HARD-08)', () => {
  it('revokes every active session after a successful reset', async () => {
    const { service, sessionService } = makeService();
    vi.mocked(sessionService.consumePasswordResetToken).mockResolvedValue(ACTIVE_USER.id);

    await service.resetPassword('reset-token', 'brand-new-password-1');

    expect(sessionService.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(sessionService.revokeAllSessions).toHaveBeenCalledWith(ACTIVE_USER.id);
  });

  it('does not revoke anything for an invalid reset token', async () => {
    const { service, sessionService } = makeService();
    vi.mocked(sessionService.consumePasswordResetToken).mockResolvedValue(null);

    await expect(service.resetPassword('bogus-token', 'whatever-123')).rejects.toThrow(
      'Invalid or expired reset token',
    );
    expect(sessionService.revokeAllSessions).not.toHaveBeenCalled();
  });
});

describe('refresh — attributes revoked-token replay to the targeted account (HARD-03)', () => {
  it('logs the stored userId when a revoked refresh token is replayed', async () => {
    const { service, sessionService } = makeService();
    const warnSpy = vi.fn();
    (service as unknown as { logger: { warn: unknown } }).logger = { warn: warnSpy };
    vi.mocked(sessionService.findSessionByTokenId).mockResolvedValue(null);
    vi.mocked(sessionService.getRevokedTokenUserId).mockResolvedValue(ACTIVE_USER.id);

    await expect(service.refresh('stolen-token', '203.0.113.9')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe('Revoked refresh token reuse detected');
    // userId is populated from the denylist instead of the old `userId: null`.
    expect(warnSpy.mock.calls[0][1]).toMatchObject({
      tokenId: 'stolen-token',
      userId: ACTIVE_USER.id,
      ip: '203.0.113.9',
      reason: 'revoked_token_reuse',
    });
  });

  it('still returns 401 without a security log for an unknown (never-revoked) token', async () => {
    const { service, sessionService } = makeService();
    const warnSpy = vi.fn();
    (service as unknown as { logger: { warn: unknown } }).logger = { warn: warnSpy };
    vi.mocked(sessionService.findSessionByTokenId).mockResolvedValue(null);
    vi.mocked(sessionService.getRevokedTokenUserId).mockResolvedValue(null);

    await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
