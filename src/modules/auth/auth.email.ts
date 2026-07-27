import { escapeHtml, isEmailConfigured, sendMail } from "../../lib/mailer.js";

function buildPasswordResetEmailHtml(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): string {
  const safeName = escapeHtml(input.name);
  const safeUrl = escapeHtml(input.resetUrl);

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
      <tr>
        <td style="padding:24px 24px 8px;">
          <h1 style="margin:0;font-size:20px;color:#111827;">Redefinição de senha</h1>
          <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">Olá, ${safeName}.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px;color:#111827;font-size:14px;line-height:1.5;">
          <p style="margin:0 0 16px;">Recebemos um pedido para redefinir a senha da sua conta no painel administrativo da Tessa.</p>
          <p style="margin:0 0 24px;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
              Redefinir senha
            </a>
          </p>
          <p style="margin:0 0 12px;color:#6b7280;font-size:13px;">Este link expira em ${String(input.expiresInMinutes)} minutos. Se você não solicitou a redefinição, ignore este e-mail.</p>
          <p style="margin:0;color:#9ca3af;font-size:12px;word-break:break-all;">${safeUrl}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildPasswordResetEmailText(input: {
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): string {
  return [
    "Redefinição de senha",
    "",
    `Olá, ${input.name}.`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta no painel administrativo da Tessa.",
    "",
    `Abra o link abaixo para escolher uma nova senha (válido por ${String(input.expiresInMinutes)} minutos):`,
    input.resetUrl,
    "",
    "Se você não solicitou a redefinição, ignore este e-mail."
  ].join("\n");
}

export function isAuthEmailConfigured(): boolean {
  return isEmailConfigured();
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  if (!isAuthEmailConfigured()) {
    throw new Error("E-mail não configurado.");
  }

  await sendMail({
    to: input.to,
    subject: "[Tessa Admin] Redefinição de senha",
    html: buildPasswordResetEmailHtml(input),
    text: buildPasswordResetEmailText(input)
  });
}
