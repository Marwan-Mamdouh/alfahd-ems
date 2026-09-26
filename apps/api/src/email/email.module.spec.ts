import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Transporter } from 'nodemailer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodemailerAdapter } from './adapters/nodemailer.adapter.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.interface.js';
import { EmailModule, buildEmailProvider } from './email.module.js';
import { EmailService } from './email.service.js';

const smtpValues = {
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'noreply@alfahd.local',
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  SMTP_USER: 'test',
  SMTP_PASS: 'test',
};

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

function mockTransporter(): Transporter & { sendMail: ReturnType<typeof vi.fn> } {
  return { sendMail: vi.fn().mockResolvedValue({}) } as unknown as Transporter & {
    sendMail: ReturnType<typeof vi.fn>;
  };
}

describe('EmailModule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects NodemailerAdapter when EMAIL_PROVIDER=smtp', () => {
    const provider = buildEmailProvider(configService({ ...smtpValues }));
    expect(provider).toBeInstanceOf(NodemailerAdapter);
  });

  it('prefers SMTP_FROM over EMAIL_FROM when both are set', () => {
    const transporter = mockTransporter();
    const adapter = new NodemailerAdapter(
      {
        host: 'localhost',
        port: 1025,
        user: 'test',
        pass: 'test',
        from: 'override@alfahd.local',
      },
      transporter,
    );
    expect(adapter).toBeInstanceOf(NodemailerAdapter);
  });

  it('throws for unsupported provider values', () => {
    expect(() => buildEmailProvider(configService({ EMAIL_PROVIDER: 'resend' }))).toThrow(
      'Unsupported EMAIL_PROVIDER: resend',
    );
  });

  it.each(['sendgrid', 'mailgun', 'postmark', 'ses'])(
    'throws "unsupported" at boot when EMAIL_PROVIDER=%s',
    (provider) => {
      expect(() =>
        buildEmailProvider(configService({ ...smtpValues, EMAIL_PROVIDER: provider })),
      ).toThrow(`Unsupported EMAIL_PROVIDER: ${provider}`);
    },
  );

  it('fails Nest DI compilation when EMAIL_PROVIDER is unsupported', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [() => ({ EMAIL_PROVIDER: 'sendgrid' })],
          }),
          EmailModule,
        ],
      }).compile(),
    ).rejects.toThrow('Unsupported EMAIL_PROVIDER: sendgrid');
  });

  it('NodemailerAdapter.send delegates to transporter.sendMail with correct payload', async () => {
    const transporter = mockTransporter();
    const adapter = new NodemailerAdapter(
      {
        host: 'localhost',
        port: 1025,
        user: 'test',
        pass: 'test',
        from: 'noreply@alfahd.local',
      },
      transporter,
    );
    await adapter.send({
      to: 'user@example.com',
      subject: 'Password Reset',
      text: 'reset body',
      html: '<p>reset body</p>',
    });
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: 'noreply@alfahd.local',
      to: 'user@example.com',
      subject: 'Password Reset',
      text: 'reset body',
      html: '<p>reset body</p>',
    });
  });

  it('NodemailerAdapter.send supports multiple recipients and omits html when absent', async () => {
    const transporter = mockTransporter();
    const adapter = new NodemailerAdapter(
      {
        host: 'localhost',
        port: 1025,
        user: 'test',
        pass: 'test',
        from: 'noreply@alfahd.local',
      },
      transporter,
    );
    await adapter.send({ to: ['a@example.com', 'b@example.com'], subject: 'Hello', text: 'hi' });
    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: 'noreply@alfahd.local',
      to: ['a@example.com', 'b@example.com'],
      subject: 'Hello',
      text: 'hi',
    });
  });

  it('EmailService.send delegates to the injected provider', async () => {
    const provider: EmailProvider = { send: vi.fn().mockResolvedValue(undefined) };
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'smtp' }));
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
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'smtp' }));
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
    const failure = new Error('SMTP unavailable');
    const provider: EmailProvider = { send: vi.fn().mockRejectedValue(failure) };
    const service = new EmailService(provider, configService({ EMAIL_PROVIDER: 'smtp' }));
    await expect(
      service.send({ to: 'user@example.com', subject: 'Hi', text: 'body' }),
    ).rejects.toThrow('SMTP unavailable');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('wires EMAIL_PROVIDER and EmailService through Nest DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ ...smtpValues })],
        }),
        EmailModule,
      ],
    }).compile();
    expect(moduleRef.get<EmailProvider>(EMAIL_PROVIDER)).toBeInstanceOf(NodemailerAdapter);
    expect(moduleRef.get(EmailService)).toBeDefined();
    await moduleRef.close();
  });
});
