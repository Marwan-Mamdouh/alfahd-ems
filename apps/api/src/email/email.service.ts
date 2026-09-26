import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
  type SendEmailOptions,
} from './email-provider.interface.js';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    private readonly configService: ConfigService,
  ) {}

  async send(options: SendEmailOptions): Promise<void> {
    const providerName = this.configService.get<string>('EMAIL_PROVIDER') ?? 'unknown';
    const recipients = Array.isArray(options.to) ? options.to.join(',') : options.to;
    try {
      await this.provider.send(options);
      this.logger.log(
        `Email sent via ${providerName} to ${recipients} subject="${options.subject}"`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Email send via ${providerName} to ${recipients} subject="${options.subject}" failed: ${reason}`,
      );
      throw error;
    }
  }
}
