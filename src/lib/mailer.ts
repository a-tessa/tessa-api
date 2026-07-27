import { createHash, randomBytes } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";
import { env } from "../env.js";

let cachedResend: Resend | null = null;
let cachedTransporter: Transporter | null = null;

function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  cachedResend ??= new Resend(env.RESEND_API_KEY);
  return cachedResend;
}

function getSmtpTransporter(): Transporter | null {
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

export function isEmailConfigured(): boolean {
  return Boolean(
    env.CONTACT_EMAIL_FROM && (env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD))
  );
}

/** @deprecated Prefer isEmailConfigured */
export function isSmtpConfigured(): boolean {
  return isEmailConfigured();
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
  if (!env.CONTACT_EMAIL_FROM) {
    throw new Error("E-mail não configurado: CONTACT_EMAIL_FROM ausente.");
  }

  const resend = getResendClient();

  if (resend) {
    const { error } = await resend.emails.send({
      from: env.CONTACT_EMAIL_FROM,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text
    });

    if (error) {
      throw new Error(error.message || "Falha ao enviar e-mail via Resend.");
    }

    return;
  }

  const transporter = getSmtpTransporter();

  if (!transporter) {
    throw new Error("E-mail não configurado: defina RESEND_API_KEY ou SMTP_*.");
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
