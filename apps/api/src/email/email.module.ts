import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodemailerAdapter } from './adapters/nodemailer.adapter.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.interface.js';
import { EmailService } from './email.service.js';

export function buildEmailProvider(config: ConfigService): EmailProvider {
  const provider = config.getOrThrow<string>('EMAIL_PROVIDER');
  switch (provider) {
    case 'smtp':
      return new NodemailerAdapter({
        host: config.getOrThrow<string>('SMTP_HOST'),
        port: config.getOrThrow<number>('SMTP_PORT'),
        user: config.getOrThrow<string>('SMTP_USER'),
        pass: config.getOrThrow<string>('SMTP_PASS'),
        from: config.get<string>('SMTP_FROM') ?? config.getOrThrow<string>('EMAIL_FROM'),
      });
    default:
      throw new Error(
        `Unsupported EMAIL_PROVIDER: ${provider}. Only "smtp" (Nodemailer) is supported.`,
      );
  }
}

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: buildEmailProvider,
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit {
  private readonly logger = new Logger(EmailModule.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.logger.log(`Using email provider: ${this.configService.get<string>('EMAIL_PROVIDER')}`);
  }
}
