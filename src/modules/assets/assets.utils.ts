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

function buildTimestampedImagePath(segments: string[], originalFilename: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filenameBase = getSafeFilenameBase(originalFilename);

  return [...segments, `${timestamp}-${filenameBase}.webp`].join("/");
}

export function buildHeroSectionImagePath(topicIndex: number, originalFilename: string): string {
  return buildTimestampedImagePath(
    ["landing-page", "home", "hero-section", `topic-${topicIndex}`],
    originalFilename
  );
}

export function buildOperationSectionImagePath(
  imageIndex: number,
  originalFilename: string
): string {
  return buildTimestampedImagePath(
    ["landing-page", "home", "operation-section", `image-${imageIndex}`],
    originalFilename
  );
}

export function buildServicePageCoverImagePath(
  servicePageSlug: string,
  originalFilename: string
): string {
  return buildTimestampedImagePath(
    ["landing-page", "services-pages", servicePageSlug, "cover"],
    originalFilename
  );
}

export function buildServicePageBackgroundImagePath(
  servicePageSlug: string,
  originalFilename: string
): string {
  return buildTimestampedImagePath(
    ["landing-page", "services-pages", servicePageSlug, "background"],
    originalFilename
  );
}

export function buildServicePageExampleImagePath(
  servicePageSlug: string,
  exampleIndex: number,
  originalFilename: string
): string {
  return buildTimestampedImagePath(
    ["landing-page", "services-pages", servicePageSlug, "examples", `example-${exampleIndex}`],
    originalFilename
  );
}
