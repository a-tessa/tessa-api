import { escapeHtml, isEmailConfigured, sendMail } from "../../lib/mailer.js";
import { resolveContactNotificationRecipients } from "../contact/contact.email.js";
import type { TalentApplicationRecord } from "./talent-application.types.js";

function formatField(label: string, value: string): string {
  const safeValue = escapeHtml(value.trim()).replaceAll("\n", "<br>");
  return `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;vertical-align:top;width:180px;">${label}</td><td style="padding:8px 12px;color:#111827;">${safeValue}</td></tr>`;
}

function buildTalentApplicationEmailHtml(application: TalentApplicationRecord): string {
  const rows = [
    formatField("Nome", application.fullName),
    formatField("E-mail", application.email),
    formatField("Celular", application.phone),
    formatField("Nível de escolaridade", application.educationLevel),
    formatField("Formação", application.education),
    formatField("Área de atuação", application.practiceArea),
    formatField("Resumo profissional", application.professionalSummary),
    formatField(
      "Recebido em",
      application.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    )
  ].join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:24px 24px 8px;">
          <h1 style="margin:0;font-size:20px;color:#111827;">Novo cadastro no banco de talentos</h1>
          <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Um visitante enviou o formulário Trabalhe conosco.</p>
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

function buildTalentApplicationEmailText(application: TalentApplicationRecord): string {
  return [
    "Novo cadastro no banco de talentos",
    "",
    `Nome: ${application.fullName}`,
    `E-mail: ${application.email}`,
    `Celular: ${application.phone}`,
    `Nível de escolaridade: ${application.educationLevel}`,
    `Formação: ${application.education}`,
    `Área de atuação: ${application.practiceArea}`,
    `Resumo profissional: ${application.professionalSummary}`,
    "",
    `Recebido em: ${application.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
  ].join("\n");
}

export async function sendTalentApplicationNotificationEmail(
  application: TalentApplicationRecord
): Promise<void> {
  if (!isEmailConfigured()) {
    return;
  }

  const to = await resolveContactNotificationRecipients();

  if (to.length === 0) {
    return;
  }

  await sendMail({
    to,
    replyTo: application.email,
    subject: `[Site Tessa] Banco de talentos — ${application.fullName}`,
    html: buildTalentApplicationEmailHtml(application),
    text: buildTalentApplicationEmailText(application)
  });
}
