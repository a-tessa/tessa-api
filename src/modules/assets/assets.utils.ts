import { basename, extname } from "node:path";

function slugifySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeOptionalText(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function getSafeFilenameBase(filename: string): string {
  const rawBase = basename(filename, extname(filename));
  const normalized = slugifySegment(rawBase);

  return normalized.length > 0 ? normalized : "image";
}

export function buildHeroSectionImagePath(topicIndex: number, originalFilename: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filenameBase = getSafeFilenameBase(originalFilename);

  return [
    "landing-page",
    "home",
    "hero-section",
    `topic-${topicIndex}`,
    `${timestamp}-${filenameBase}.webp`
  ].join("/");
}
