import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SENDGRID_TIMEOUT_MS, SendGridAdapter } from './adapters/sendgrid.adapter.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.interface.js';
import { EmailModule, buildEmailProvider } from './email.module.js';
import { EmailService } from './email.service.js';

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    setTimeout: vi.fn(),
    send: vi.fn(),
  },
}));

const mockedSgMail = vi.mocked(sgMail);

function configService(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string, defaultValue?: unknown) => values[key] ?? defaultValue,
    getOrThrow: (key: string) => {
      const value = values[key];
      if (value === undefined || value === null) {
        throw new Error(`Configuration key "${key}" does not exist`);
      }
      return value;
    },
  } as unknown as ConfigService;
}

describe('EmailModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects SendGridAdapter when EMAIL_PROVIDER=sendgrid', () => {
    const provider = buildEmailProvider(
      configService({
        EMAIL_PROVIDER: 'sendgrid',
        SENDGRID_API_KEY: 'SG.test-key',
        EMAIL_FROM: 'noreply@alfahd.local',
      }),
    );
    expect(provider).toBeInstanceOf(SendGridAdapter);
  });

  it('throws for unknown provider values', () => {
    expect(() => buildEmailProvider(configService({ EMAIL_PROVIDER: 'resend' }))).toThrow(
      'Unsupported EMAIL_PROVIDER: resend',
    );
  });

  it.each(['smtp', 'mailgun', 'postmark', 'ses'])(
    'throws "not yet implemented" at boot when EMAIL_PROVIDER=%s',
    (provider) => {
      expect(() => buildEmailProvider(configService({ EMAIL_PROVIDER: provider }))).toThrow(
        `Email provider "${provider}" is not yet implemented`,
      );
    },
  );

  it('fails Nest DI compilation when EMAIL_PROVIDER is unimplemented', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [() => ({ EMAIL_PROVIDER: 'smtp' })],
          }),
          EmailModule,
        ],
      }).compile(),
    ).rejects.toThrow('Email provider "smtp" is not yet implemented');
  });

  it('SendGridAdapter sets API key and 10s timeout in constructor', () => {
    new SendGridAdapter('SG.test-key', 'noreply@alfahd.local');
    expect(mockedSgMail.setApiKey).toHaveBeenCalledWith('SG.test-key');
    expect(mockedSgMail.setTimeout).toHaveBeenCalledWith(SENDGRID_TIMEOUT_MS);
    expect(SENDGRID_TIMEOUT_MS).toBe(10_000);
  });

  it('SendGridAdapter.send delegates to sgMail.send with correct payload', async () => {
    mockedSgMail.send.mockResolvedValue([{}, {}] as never);
    const adapter = new SendGridAdapter('SG.test-key', 'noreply@alfahd.local');
    await adapter.send({
      to: 'user@example.com',
      subject: 'Password Reset',
      text: 'reset body',
      html: '<p>reset body</p>',
    });
    expect(mockedSgMail.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      from: 'noreply@alfahd.local',
      subject: 'Password Reset',
      text: 'reset body',
      html: '<p>reset body</p>',
    });
  });

  it('SendGridAdapter.send supports multiple recipients and omits html when absent', async () => {
    mockedSgMail.send.mockResolvedValue([{}, {}] as never);
    const adapter = new SendGridAdapter('SG.test-key', 'noreply@alfahd.local');
    await adapter.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Hello',
      text: 'hi',
    });
    expect(mockedSgMail.send).toHaveBeenCalledWith({
      to: ['a@example.com', 'b@example.com'],
      from: 'noreply@alfahd.local',
      subject: 'Hello',
      text: 'hi',
    });
  });

  it('EmailService.send delegates to the injected provider', async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'sendgrid' }));
    await service.send({ to: 'user@example.com', subject: 'Hi', text: 'body' });
    expect(provider.send).toHaveBeenCalledWith({
      to: 'user@example.com',
      subject: 'Hi',
      text: 'body',
    });
  });

  it('EmailService logs info on success and never logs the body', async () => {
    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'sendgrid' }));
    await service.send({
      to: 'user@example.com',
      subject: 'Password Reset',
      text: 'super-secret-body',
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const message = String(logSpy.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('user@example.com');
    expect(message).toContain('Password Reset');
    expect(message).not.toContain('super-secret-body');
    logSpy.mockRestore();
  });

  it('EmailService logs warn and rethrows on failure', async () => {
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const failure = new Error('SendGrid unavailable');
    const provider: EmailProvider = { send: vi.fn().mockRejectedValue(failure) };
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'sendgrid' }));
    await expect(
      service.send({ to: 'user@example.com', subject: 'Hi', text: 'body' }),
    ).rejects.toThrow('SendGrid unavailable');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('wires EMAIL_PROVIDER and EmailService through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              EMAIL_PROVIDER: 'sendgrid',
              SENDGRID_API_KEY: 'SG.test-key',
              EMAIL_FROM: 'noreply@alfahd.local',
            }),
          ],
        }),
        EmailModule,
      ],
    }).compile();
    expect(moduleRef.get<EmailProvider>(EMAIL_PROVIDER)).toBeInstanceOf(SendGridAdapter);
    expect(moduleRef.get(EmailService)).toBeDefined();
    await moduleRef.close();
  });
});
