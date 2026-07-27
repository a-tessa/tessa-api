import { badRequest } from "../../lib/http.js";
import { updateUserProfileSchema } from "./users.schemas.js";
import type { UpdateUserProfileInput } from "./users.types.js";

function normalizeOptionalFormString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Unlike name/email, CPF and phone may be cleared with an empty string.
 * Missing key → undefined (unchanged). Present empty → null (clear).
 */
function normalizeClearableFormString(
  formData: FormData,
  key: string
): string | null | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRemoveAvatar(value: FormDataEntryValue | null): boolean | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true" || normalized === "1") {
    return true;
  }

  if (normalized === "false" || normalized === "0") {
    return false;
  }

  return undefined;
}

export function parseUpdateUserProfileRequest(
  contentType: string,
  body: unknown,
  formData?: FormData
): { input: UpdateUserProfileInput; avatarFile: File | null } {
  if (contentType.startsWith("multipart/form-data")) {
    if (!formData) {
      badRequest("Formulário inválido.");
    }

    const parsed = updateUserProfileSchema.safeParse({
      name: normalizeOptionalFormString(formData.get("name")),
      email: normalizeOptionalFormString(formData.get("email")),
      cpf: normalizeClearableFormString(formData, "cpf"),
      phone: normalizeClearableFormString(formData, "phone"),
      removeAvatar: parseRemoveAvatar(formData.get("removeAvatar"))
    });

    if (!parsed.success) {
      badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos.");
    }

    const avatarEntry = formData.get("avatar");
    const avatarFile = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

    return { input: parsed.data, avatarFile };
  }

  const parsed = updateUserProfileSchema.safeParse(body);

  if (!parsed.success) {
    badRequest(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }

  return { input: parsed.data, avatarFile: null };
}
