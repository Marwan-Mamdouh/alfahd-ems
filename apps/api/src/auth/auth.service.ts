import { Role, type LoginResponseDto, type RefreshTokenResponseDto } from '@alfahd/types';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { hash, verify } from 'argon2';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type Db } from '../database/database.module.js';
import { users, type User } from '../database/schema/index.js';
import { ARGON2_OPTIONS, toUserDto } from '../database/schema/mappers.js';
import { EmailService } from '../email/email.service.js';
import { SessionService } from '../redis/session.service.js';
import type { ChangePasswordRequestDto } from './dto.js';

// Fixed argon2id dummy hash with the same cost parameters as ARGON2_OPTIONS
// (m=65536, t=3, p=1). Safe to parse and verify; always returns false.
export const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=1,t=3$Qyj4rKb7LqEEH5DTNIuaMg$hK00Pkq2YCFstEGrCMjt0Fb/+owHrnS7uT4w6dRZk7s';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly sessionService: SessionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private signAccessToken(user: User, tokenId: string): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role as Role,
      jti: tokenId,
    };
    return this.jwtService.sign(payload, {
      expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ??
        '15m') as JwtSignOptions['expiresIn'],
    });
  }

  private async findActiveUserByEmail(email: string): Promise<User | null> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];

    // Constant-time failure path: if user does not exist, run a dummy argon2 verify
    // so wall time is comparable to an existing user with wrong credentials, preventing
    // user enumeration through timing differences.
    if (!user) {
      await verify(DUMMY_HASH, password);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Inactive/deactivated users with valid credentials must be rejected with 403 Forbidden.
    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    const tokenId = randomUUID();
    await this.sessionService.createSession(user.id, tokenId);
    return {
      accessToken: this.signAccessToken(user, tokenId),
      refreshToken: tokenId,
      user: toUserDto(user),
    };
  }

  async refresh(refreshToken: string, ip?: string): Promise<RefreshTokenResponseDto> {
    const userId = await this.sessionService.consumeSessionForRotation(refreshToken);
    if (!userId) {
      if (await this.sessionService.isRotated(refreshToken)) {
        this.logger.warn('Rotated refresh token replayed', {
          tokenId: refreshToken,
          ip: ip ?? 'unknown',
          timestamp: new Date().toISOString(),
          reason: 'rotated_token_replay',
        });
      } else {
        const revokedUserId = await this.sessionService.getRevokedTokenUserId(refreshToken);
        if (revokedUserId) {
          this.logger.warn('Revoked refresh token reuse detected', {
            tokenId: refreshToken,
            userId: revokedUserId,
            ip: ip ?? 'unknown',
            timestamp: new Date().toISOString(),
            reason: 'revoked_token_reuse',
          });
        }
      }
      // Replay or unknown token => 401. Deliberate scope decision: do not revoke
      // all sessions for the user to avoid logging out every tab on benign races.
      // The losing tab may still receive 401 and redirect to login, but its cookie
      // is not cleared so concurrent/winning sessions survive.
      throw new UnauthorizedException('Invalid refresh token');
    }

    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      // Inactive/deactivated user: clear the rotated marker so the controller
      // clears the dead cookie, and revoke in denylist for attribution.
      await this.sessionService.clearRotated(refreshToken);
      await this.sessionService.revokeSession(userId, refreshToken);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newTokenId = randomUUID();
    await this.sessionService.createSession(user.id, newTokenId);
    await this.sessionService.revokeSession(user.id, refreshToken);

    return {
      accessToken: this.signAccessToken(user, newTokenId),
      refreshToken: newTokenId,
    };
  }

  /**
   * Facade delegating to SessionService.isRotated. Used by the controller to
   * prevent clearing a newly-rotated cookie when a losing concurrent tab fails.
   */
  async wasRotatedRefreshToken(tokenId: string): Promise<boolean> {
    return this.sessionService.isRotated(tokenId);
  }

  /**
   * Log out a user by revoking all sessions for their account.
   *
   * Token rotation causes previously-issued access tokens to hold a stale
   * jti (the pre-rotation tokenId). Revoking all sessions for the account
   * ensures logout terminates live sessions across devices without requiring
   * a stateful session-grouping lookup.
   */
  async logout(userId: string): Promise<void> {
    await this.sessionService.revokeAllSessions(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.findActiveUserByEmail(email);
    if (!user) {
      return;
    }
    const token = randomUUID();
    await this.sessionService.createPasswordResetToken(token, user.id);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    // Must match the dashboard route exactly. The page lives at
    // `src/app/auth/reset-password/page.tsx`, so the App Router serves it at
    // `/auth/reset-password` — a link to `/reset-password` 404s, and the user who
    // clicked it can never complete recovery.
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`;

    try {
      await this.emailService.send({
        to: user.email,
        subject: 'Password reset',
        text: `You requested a password reset. Use this link within 1 hour: ${resetLink}`,
        html: `<p>You requested a password reset. Use this link within 1 hour:</p><p><a href="${resetLink}">Reset password</a></p>`,
      });
    } catch (error) {
      // Swallow delivery failures so the HTTP response never depends on whether
      // the address is registered. Letting this throw produced 500 for a known
      // address and 200 for an unknown one — a perfect account-enumeration
      // oracle, reachable whenever SMTP is unavailable (i.e. any local machine
      // without MailHog, and any production mail outage). EmailService already
      // logs the cause; the caller still gets the neutral "if registered" reply.
      this.logger.warn('Password-reset email delivery failed', {
        reason: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Atomically consume the token first — single-use is enforced even on crash
    const userId = await this.sessionService.consumePasswordResetToken(token);
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    // Reset via a (possibly stolen) token must kill every session that could
    // have been established under the old credential — otherwise an attacker
    // holding an old refresh token keeps access for up to 7 days.
    await this.sessionService.revokeAllSessions(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordRequestDto): Promise<void> {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!(await verify(user.passwordHash, dto.oldPassword))) {
      throw new BadRequestException('Old password is incorrect');
    }

    const passwordHash = await hash(dto.newPassword, ARGON2_OPTIONS);
    await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Issue #14 choice: revoke every session, including the caller's, and let the
    // client log in again with the new credential. Re-issuing the caller's session
    // here would keep a pre-change token alive across the security boundary.
    // Access tokens (stateless JWTs) can still work until they expire (<=15m);
    // refresh is dead immediately, which is what "force re-login" means here.
    await this.sessionService.revokeAllSessions(userId);
  }
}
