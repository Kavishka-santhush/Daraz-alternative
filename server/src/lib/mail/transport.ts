import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env';
import logger from '../../config/logger';

let transporter: Transporter | undefined;

function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Sends an email. In dev with no SMTP configured it logs instead of throwing. */
export async function sendMail(input: MailInput): Promise<void> {
  if (!env.smtp.host || env.smtp.host.startsWith('dev-')) {
    logger.info(`[mail:dev] To ${input.to}: ${input.subject}`);
    return;
  }
  try {
    await getTransport().sendMail({ from: env.smtp.from, ...input });
  } catch (err) {
    logger.error('Failed to send email', (err as Error).message);
    // Email failures must never break a business transaction.
  }
}
