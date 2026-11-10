import { describe, expect, it, vi, beforeAll } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import { AuthService, DUMMY_HASH } from './auth.service.js';

vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return {
    ...actual,
    verify: vi.fn(actual.verify),
  };
});
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
    consumeSessionForRotation: vi.fn().mockResolvedValue(null),
    clearRotated: vi.fn().mockResolvedValue(undefined),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    markRotated: vi.fn().mockResolvedValue(undefined),
    isRotated: vi.fn().mockResolvedValue(false),
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

  return { service, emailService, sessionService, jwtService };
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
  it('returns access token, refresh token, and user dto for valid credentials', async () => {
    const { service, sessionService } = makeService({ rows: [ACTIVE_USER] });

    const result = await service.login('admin@alfahd.local', PASSWORD);

    expect(result).toHaveProperty('accessToken', 'signed.jwt.token');
    expect(result).toHaveProperty('refreshToken');
    expect(result.user).toEqual({
      id: ACTIVE_USER.id,
      email: ACTIVE_USER.email,
      role: ACTIVE_USER.role,
      isActive: true,
      createdAt: ACTIVE_USER.createdAt.toISOString(),
    });
    expect(sessionService.createSession).toHaveBeenCalledWith(ACTIVE_USER.id, result.refreshToken);
  });

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
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException (403) for an inactive user with valid credentials', async () => {
    const { service, sessionService } = makeService({
      rows: [{ ...ACTIVE_USER, isActive: false }],
    });

    await expect(service.login('admin@alfahd.local', PASSWORD)).rejects.toThrow(ForbiddenException);

    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('runs the same single hash verify against a dummy hash when the user does not exist (no user-enumeration path)', async () => {
    // Non-enumeration timing mitigation: verify must run against DUMMY_HASH for unknown emails
    // so wall time matches an existing account with an invalid password.
    const verifyMock = vi.mocked(verify);

    // Path 1: Nonexistent email
    const { service: ghostService } = makeService({ rows: [] });
    verifyMock.mockClear();
    await expect(ghostService.login('ghost@fahdgroup.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith(DUMMY_HASH, 'wrong-password');

    // Path 2: Existing user with wrong password
    const { service: existingService } = makeService({ rows: [ACTIVE_USER] });
    verifyMock.mockClear();
    await expect(existingService.login('admin@alfahd.local', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith(ACTIVE_USER.passwordHash, 'wrong-password');
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
  it('logs benign rotated refresh token replay with reason rotated_token_replay', async () => {
    const { service, sessionService } = makeService();
    const warnSpy = vi.fn();
    (service as unknown as { logger: { warn: unknown } }).logger = { warn: warnSpy };
    vi.mocked(sessionService.consumeSessionForRotation).mockResolvedValue(null);
    vi.mocked(sessionService.isRotated).mockResolvedValue(true);

    await expect(service.refresh('rotated-token', '203.0.113.9')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe('Rotated refresh token replayed');
    expect(warnSpy.mock.calls[0][1]).toMatchObject({
      tokenId: 'rotated-token',
      ip: '203.0.113.9',
      reason: 'rotated_token_replay',
    });
    expect(sessionService.getRevokedTokenUserId).not.toHaveBeenCalled();
  });

  it('logs the stored userId when a revoked refresh token is replayed', async () => {
    const { service, sessionService } = makeService();
    const warnSpy = vi.fn();
    (service as unknown as { logger: { warn: unknown } }).logger = { warn: warnSpy };
    vi.mocked(sessionService.consumeSessionForRotation).mockResolvedValue(null);
    vi.mocked(sessionService.isRotated).mockResolvedValue(false);
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
    vi.mocked(sessionService.consumeSessionForRotation).mockResolvedValue(null);
    vi.mocked(sessionService.isRotated).mockResolvedValue(false);
    vi.mocked(sessionService.getRevokedTokenUserId).mockResolvedValue(null);

    await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('refresh — token rotation (Issue #9)', () => {
  it('rotates refresh token on use: consumes old, creates new session, revokes old, and signs with new jti', async () => {
    const { service, sessionService, jwtService } = makeService({ rows: [ACTIVE_USER] });
    vi.mocked(sessionService.consumeSessionForRotation).mockResolvedValue(ACTIVE_USER.id);

    const result = await service.refresh('old-token-id', '127.0.0.1');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.refreshToken).toBeDefined();
    expect(result.refreshToken).not.toBe('old-token-id');
    expect(result.refreshToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(sessionService.consumeSessionForRotation).toHaveBeenCalledWith('old-token-id');
    expect(sessionService.createSession).toHaveBeenCalledWith(ACTIVE_USER.id, result.refreshToken);
    expect(sessionService.revokeSession).toHaveBeenCalledWith(ACTIVE_USER.id, 'old-token-id');
    // markRotated is handled atomically in Lua inside consumeSessionForRotation, not called here
    expect(sessionService.markRotated).not.toHaveBeenCalled();
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: ACTIVE_USER.id,
        jti: result.refreshToken,
      }),
      expect.anything(),
    );
  });

  it('rejects deactivated user with consumed token, clears rotated marker, revokes token in denylist, and does not create new session', async () => {
    const { service, sessionService } = makeService({
      rows: [{ ...ACTIVE_USER, isActive: false }],
    });
    vi.mocked(sessionService.consumeSessionForRotation).mockResolvedValue(ACTIVE_USER.id);

    await expect(service.refresh('old-token-id')).rejects.toThrow(UnauthorizedException);

    expect(sessionService.clearRotated).toHaveBeenCalledWith('old-token-id');
    expect(sessionService.createSession).not.toHaveBeenCalled();
    expect(sessionService.revokeSession).toHaveBeenCalledWith(ACTIVE_USER.id, 'old-token-id');
  });

  it('wasRotatedRefreshToken delegates to sessionService.isRotated', async () => {
    const { service, sessionService } = makeService();
    vi.mocked(sessionService.isRotated).mockResolvedValue(true);

    await expect(service.wasRotatedRefreshToken('some-token')).resolves.toBe(true);
    expect(sessionService.isRotated).toHaveBeenCalledWith('some-token');
  });
});

describe('logout — account-wide session revocation (Issue #9 follow-up)', () => {
  it('revokes all sessions for the account and does not call revokeSession with stale jti', async () => {
    const { service, sessionService } = makeService();

    await service.logout('user-1');

    expect(sessionService.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(sessionService.revokeAllSessions).toHaveBeenCalledWith('user-1');
    expect(sessionService.revokeSession).not.toHaveBeenCalled();
  });
});
