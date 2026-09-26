import sgMail from '@sendgrid/mail';
import type { EmailProvider, SendEmailOptions } from '../email-provider.interface.js';

export const SENDGRID_TIMEOUT_MS = 10_000;

export class SendGridAdapter implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    sgMail.setApiKey(apiKey);
    sgMail.setTimeout(SENDGRID_TIMEOUT_MS);
  }

  async send(options: SendEmailOptions): Promise<void> {
    await sgMail.send({
      to: options.to,
      from: this.from,
      subject: options.subject,
      text: options.text,
      ...(options.html !== undefined ? { html: options.html } : {}),
    });
  }
}
