import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendGridAdapter } from './adapters/sendgrid.adapter.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.interface.js';
import { EmailService } from './email.service.js';

export function buildEmailProvider(config: ConfigService): EmailProvider {
  const provider = config.getOrThrow<string>('EMAIL_PROVIDER');
  switch (provider) {
    case 'sendgrid':
      return new SendGridAdapter(
        config.getOrThrow<string>('SENDGRID_API_KEY'),
        config.getOrThrow<string>('EMAIL_FROM'),
      );
    case 'smtp':
    case 'mailgun':
    case 'postmark':
    case 'ses':
      throw new Error(
        `Email provider "${provider}" is not yet implemented. Set EMAIL_PROVIDER=sendgrid.`,
      );
    default:
      throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
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
