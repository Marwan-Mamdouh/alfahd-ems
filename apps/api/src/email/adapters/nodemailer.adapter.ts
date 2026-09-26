import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailProvider, SendEmailOptions } from '../email-provider.interface.js';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class NodemailerAdapter implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig, transporter?: Transporter) {
    this.from = config.from;
    this.transporter =
      transporter ??
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });
  }

  async send(options: SendEmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      ...(options.html !== undefined ? { html: options.html } : {}),
    });
  }
}
