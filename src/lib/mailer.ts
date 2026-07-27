import { createHash, randomBytes } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env.js";

let cachedTransporter: Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.CONTACT_EMAIL_FROM);
}

export function getSmtpTransporter(): Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return null;
  }

  cachedTransporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });

  return cachedTransporter;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<void> {
  const transporter = getSmtpTransporter();

  if (!transporter || !env.CONTACT_EMAIL_FROM) {
    throw new Error("SMTP não configurado.");
  }

  await transporter.sendMail({
    from: env.CONTACT_EMAIL_FROM,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    html: input.html,
    text: input.text
  });
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
