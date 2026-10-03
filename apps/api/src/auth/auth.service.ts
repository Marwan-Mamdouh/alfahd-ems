import { Role, type LoginResponseDto } from '@alfahd/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
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
    const user = await this.findActiveUserByEmail(email);
    if (!user || !(await verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokenId = randomUUID();
    await this.sessionService.createSession(user.id, tokenId);
    return {
      accessToken: this.signAccessToken(user, tokenId),
      refreshToken: tokenId,
      user: toUserDto(user),
    };
  }

  async refresh(refreshToken: string, ip?: string): Promise<{ accessToken: string }> {
    const session = await this.sessionService.findSessionByTokenId(refreshToken);
    if (!session) {
      if (await this.sessionService.isRevoked(refreshToken)) {
        this.logger.warn('Revoked refresh token reuse detected', {
          tokenId: refreshToken,
          userId: null, // Session already deleted; userId not resolvable
          ip: ip ?? 'unknown',
          timestamp: new Date().toISOString(),
          reason: 'revoked_token_reuse',
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
    const rows = await this.db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    const user = rows[0];
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { accessToken: this.signAccessToken(user, refreshToken) };
  }

  async logout(userId: string, tokenId: string): Promise<void> {
    await this.sessionService.revokeSession(userId, tokenId);
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
  }
}
