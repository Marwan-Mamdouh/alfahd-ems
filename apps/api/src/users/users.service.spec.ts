import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@alfahd/types';
import { BadRequestException } from '@nestjs/common';
import { hash } from 'argon2';
import { UsersService } from './users.service.js';
import type { Db } from '../database/database.module.js';
import type { EmailService } from '../email/email.service.js';
import type { SessionService } from '../redis/session.service.js';
import type { User } from '../database/schema/index.js';

describe('UsersService', () => {
  let service: UsersService;
  let dbMock: any;
  let emailServiceMock: { send: ReturnType<typeof vi.fn> };
  let sessionServiceMock: {
    revokeAllSessions: ReturnType<typeof vi.fn>;
    createSession?: ReturnType<typeof vi.fn>;
  };
  let setSpy: ReturnType<typeof vi.fn>;

  const baseUser: User = {
    id: 'user-1',
    name: 'Ahmed Mostafa',
    email: 'ahmed@alfahd.local',
    passwordHash: 'hash',
    role: Role.TECHNICIAN,
    department: 'TECHNICAL',
    phone: null,
    nationalId: null,
    hireDate: null,
    profilePhotoKey: null,
    status: 'ACTIVE',
    assignedWarehouseId: null,
    isActive: true,
    createdAt: new Date('2026-01-01T08:00:00Z'),
    updatedAt: new Date('2026-01-01T08:00:00Z'),
  };

  beforeEach(() => {
    emailServiceMock = { send: vi.fn().mockResolvedValue(undefined) };
    sessionServiceMock = { revokeAllSessions: vi.fn().mockResolvedValue(0) };
    setSpy = vi.fn((vals: Record<string, unknown>) => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ ...baseUser, ...vals }]),
      })),
    }));
    dbMock = {
      // Default: a row exists (used by findRowOrThrow). Tests that must see an
      // empty table (e.g. duplicate-email check) override `select`.
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([baseUser]),
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({ offset: vi.fn().mockResolvedValue([baseUser]) })),
            })),
            then: undefined,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => ({
          returning: vi.fn().mockResolvedValue([{ ...baseUser, ...vals }]),
        })),
      })),
      update: vi.fn(() => ({ set: setSpy })),
    };
    service = new UsersService(
      dbMock as Db,
      emailServiceMock as unknown as EmailService,
      sessionServiceMock as unknown as SessionService,
    );
  });

  describe('createEmployee — welcome email (SEC-02)', () => {
    it('HTML-escapes the name before interpolating it into the email body', async () => {
      dbMock.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
        })),
      }));

      const payload = '<img src=x onerror=alert(document.cookie)>';
      await service.createEmployee({
        name: payload,
        email: 'newbie@alfahd.local',
        role: Role.CS,
      });

      expect(emailServiceMock.send).toHaveBeenCalledTimes(1);
      const sent = emailServiceMock.send.mock.calls[0][0] as { html: string; text: string };
      expect(sent.html).not.toContain('<img');
      expect(sent.html).toContain('&lt;img src=x onerror=alert(document.cookie)&gt;');
      // Plain-text part carries the raw name safely (no HTML interpretation).
      expect(sent.text).toContain(payload);
    });
  });

  describe('updateEmployeeStatus — isActive vs status reconciliation (SIMP-04)', () => {
    it.each([
      ['ACTIVE', true],
      ['ON_LEAVE', true],
      ['INACTIVE', false],
    ] as const)('sets isActive=%s when status is %s', async (status, expectedIsActive) => {
      const updated = await service.updateEmployeeStatus('user-1', status);

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status, isActive: expectedIsActive }),
      );
      expect(updated.isActive).toBe(expectedIsActive);
      expect(updated.status).toBe(status);
    });

    it('keeps ON_LEAVE accounts able to authenticate (sessions/login stay valid)', async () => {
      const updated = await service.updateEmployeeStatus('user-1', 'ON_LEAVE');
      // AuthService.findActiveUserByEmail only rejects isActive=false users, so
      // an ON_LEAVE employee keeps their sessions per spec scenario 5, while
      // `status !== 'ACTIVE'` still excludes them from check-in/assignment.
      expect(updated.isActive).toBe(true);
      expect(updated.status).not.toBe('ACTIVE');
    });
  });

  describe('deactivation revokes sessions (HARD-05)', () => {
    it('revokes all sessions when a user is deactivated', async () => {
      const updated = await service.deactivate('user-1', 'admin-9');

      expect(updated.isActive).toBe(false);
      expect(sessionServiceMock.revokeAllSessions).toHaveBeenCalledWith('user-1');
    });

    it('keeps sessions for updates that do not deactivate', async () => {
      await service.update('user-1', { role: Role.CS });

      expect(sessionServiceMock.revokeAllSessions).not.toHaveBeenCalled();
    });

    it('rejects self-deactivation before touching sessions (controller passes the caller)', async () => {
      await expect(service.update('user-1', { isActive: false }, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deactivate('user-1', 'user-1')).rejects.toThrow(BadRequestException);

      expect(sessionServiceMock.revokeAllSessions).not.toHaveBeenCalled();
    });
  });

  describe('changePassword revokes sessions (HARD-08)', () => {
    // `verify` needs a real argon2 hash: a malformed one throws instead of
    // returning false, masking the behaviour under test.
    const withRealHash = async () => {
      const realHash = await hash('oldPassword123');
      dbMock.select = vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{ ...baseUser, passwordHash: realHash }]),
          })),
        })),
      }));
    };

    it('revokes all live sessions after a successful password change', async () => {
      await withRealHash();

      await service.changePassword('user-1', {
        oldPassword: 'oldPassword123',
        newPassword: 'brandNewPassword456',
      });

      expect(sessionServiceMock.revokeAllSessions).toHaveBeenCalledWith('user-1');
    });

    it('keeps sessions when the old password is wrong', async () => {
      await withRealHash();

      await expect(
        service.changePassword('user-1', {
          oldPassword: 'not-the-password',
          newPassword: 'brandNewPassword456',
        }),
      ).rejects.toThrow('Old password is incorrect');

      expect(sessionServiceMock.revokeAllSessions).not.toHaveBeenCalled();
    });
  });
});
