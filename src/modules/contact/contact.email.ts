import { env } from "../../env.js";
import { escapeHtml, isEmailConfigured, sendMail } from "../../lib/mailer.js";
import type { ContactRecord } from "./contact.types.js";

function formatField(label: string, value: string | null | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  const safeValue = escapeHtml(value.trim());
  return `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;vertical-align:top;width:140px;">${label}</td><td style="padding:8px 12px;color:#111827;">${safeValue}</td></tr>`;
}

function buildContactEmailHtml(contact: ContactRecord): string {
  const rows = [
    formatField("Nome", contact.fullName),
    formatField("E-mail", contact.email),
    formatField("Telefone", contact.phone),
    formatField("Empresa", contact.companyName),
    formatField("Cidade", contact.city),
    formatField("Estado", contact.state),
    formatField("Serviço", contact.service),
    formatField("Mensagem", contact.message),
    formatField(
      "Recebido em",
      contact.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    )
  ]
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:24px 24px 8px;">
          <h1 style="margin:0;font-size:20px;color:#111827;">Novo contato pelo site</h1>
          <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Um visitante enviou o formulário de contato.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${rows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildContactEmailText(contact: ContactRecord): string {
  const lines = [
    "Novo contato pelo site",
    "",
    `Nome: ${contact.fullName}`,
    `E-mail: ${contact.email}`,
    `Telefone: ${contact.phone}`,
    `Empresa: ${contact.companyName}`,
    `Cidade: ${contact.city}`,
    `Estado: ${contact.state}`
  ];

  if (contact.service) {
    lines.push(`Serviço: ${contact.service}`);
  }

  if (contact.message) {
    lines.push(`Mensagem: ${contact.message}`);
  }

  lines.push(
    "",
    `Recebido em: ${contact.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
  );

  return lines.join("\n");
}

export function isContactEmailConfigured(): boolean {
  return Boolean(isEmailConfigured() && env.CONTACT_NOTIFICATION_EMAIL);
}

export async function sendContactNotificationEmail(contact: ContactRecord): Promise<void> {
  if (!isContactEmailConfigured() || !env.CONTACT_NOTIFICATION_EMAIL) {
    return;
  }

  const subject = `[Site Tessa] Novo contato — ${contact.fullName} / ${contact.companyName}`;

  await sendMail({
    to: env.CONTACT_NOTIFICATION_EMAIL,
    replyTo: contact.email,
    subject,
    html: buildContactEmailHtml(contact),
    text: buildContactEmailText(contact)
  });
}
