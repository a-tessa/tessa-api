/**
 * Digits-only CPF helpers and check-digit validation.
 */

export function normalizeCpfDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

export function formatCpfDisplay(digits: string): string {
  const d = normalizeCpfDigits(digits);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function cpfCheckDigit(base: string, factorStart: number): number {
  let sum = 0;

  for (let index = 0; index < base.length; index += 1) {
    sum += Number(base[index]) * (factorStart - index);
  }

  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(raw: string): boolean {
  const digits = normalizeCpfDigits(raw);

  if (digits.length !== 11) {
    return false;
  }

  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const first = cpfCheckDigit(digits.slice(0, 9), 10);
  const second = cpfCheckDigit(digits.slice(0, 10), 11);

  return first === Number(digits[9]) && second === Number(digits[10]);
}

/** National digits only (DDD + number), up to 11. Strips leading 55 when pasted. */
export function normalizeBrazilPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length > 11) {
    digits = digits.slice(2, 13);
  } else {
    digits = digits.slice(0, 11);
  }

  return digits;
}

/** Mask (DD) mobile 9XXXX-XXXX or landline XXXX-XXXX. */
export function formatBrazilPhoneDisplay(digitsOrRaw: string): string {
  const digits = normalizeBrazilPhoneDigits(digitsOrRaw);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  const isMobile = rest[0] === "9";

  if (isMobile) {
    const sub = rest.slice(0, 9);
    if (sub.length <= 5) return `(${ddd}) ${sub}`;
    return `(${ddd}) ${sub.slice(0, 5)}-${sub.slice(5)}`;
  }

  const sub = rest.slice(0, 8);
  if (sub.length <= 4) return `(${ddd}) ${sub}`;
  return `(${ddd}) ${sub.slice(0, 4)}-${sub.slice(4)}`;
}

export function isValidBrazilPhone(raw: string): boolean {
  const digits = normalizeBrazilPhoneDigits(raw);
  return digits.length === 10 || digits.length === 11;
}
