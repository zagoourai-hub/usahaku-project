import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * SMTP sender (dev: Mailpit on smtp://localhost:1025, prod: Resend/any SMTP).
 * Without SMTP_URL nothing is sent. Links carry one-time tokens, so message
 * bodies are never logged.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null = process.env.SMTP_URL
    ? createTransport(process.env.SMTP_URL)
    : null;

  async send(mail: Mail) {
    if (!this.transport) {
      this.logger.warn(`SMTP_URL not set: "${mail.subject}" was not sent`);
      return;
    }
    await this.transport.sendMail({
      from: process.env.MAIL_FROM || 'UsahaKu <no-reply@usahaku.local>',
      ...mail,
    });
  }
}
