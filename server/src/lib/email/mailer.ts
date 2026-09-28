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

/** Sends an email. Never throws — logs failures so callers are not blocked. */
export async function sendMail(input: MailInput): Promise<void> {
  try {
    if (!env.smtp.user && env.nodeEnv !== 'production') {
      logger.info(`[email:dev] to=${input.to} subject=${input.subject}`);
      return;
    }
    await getTransport().sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  } catch (err) {
    logger.error('Failed to send email', (err as Error).message);
  }
}

export default sendMail;
