import { z } from "zod";
import { getYouTubeVideoId } from "../content/content.youtube.js";

const nonEmptyString = z.string().trim().min(1);

export const MAX_GALLERY_PHOTOS = 120;
export const MAX_GALLERY_VIDEOS = 60;
export const MAX_GALLERY_ALT_LENGTH = 100;
export const MAX_GALLERY_CAPTION_LENGTH = 300;
export const MAX_GALLERY_PHOTO_BYTES = 3 * 1024 * 1024;

export const galleryMediaKindSchema = z.enum(["photo", "video"]);

function optionalBoundedString(maximumLength: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    nonEmptyString.max(maximumLength).optional()
  );
}

const galleryCaptionSchema = optionalBoundedString(MAX_GALLERY_CAPTION_LENGTH);

const optionalCategorySlugSchema = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    return value;
  },
  z.union([nonEmptyString, z.null()]).optional()
);

function refineCaptionDiffersFromAlt(
  item: { alt?: string; caption?: string },
  context: z.RefinementCtx
): void {
  if (
    typeof item.alt === "string" &&
    typeof item.caption === "string" &&
    item.alt === item.caption
  ) {
    context.addIssue({
      code: "custom",
      message: "A legenda deve ser diferente do texto alternativo.",
      path: ["caption"]
    });
  }
}

export const galleryListQuerySchema = z.object({
  kind: galleryMediaKindSchema.optional(),
  categorySlug: z.string().trim().optional()
});

export const galleryIdParamsSchema = z.object({
  id: nonEmptyString
});

export const createGalleryVideoSchema = z
  .object({
    youtubeUrl: nonEmptyString.refine(
      (url) => getYouTubeVideoId(url) !== null,
      "Informe uma URL válida do YouTube."
    ),
    alt: nonEmptyString.max(MAX_GALLERY_ALT_LENGTH),
    caption: galleryCaptionSchema,
    categorySlug: optionalCategorySlugSchema,
    order: z.coerce.number().int().min(0).max(9999).optional()
  })
  .superRefine(refineCaptionDiffersFromAlt);

export const updateGalleryMediaItemSchema = z
  .object({
    alt: nonEmptyString.max(MAX_GALLERY_ALT_LENGTH).optional(),
    caption: galleryCaptionSchema.nullable().optional(),
    categorySlug: optionalCategorySlugSchema,
    order: z.coerce.number().int().min(0).max(9999).optional(),
    youtubeUrl: nonEmptyString
      .refine((url) => getYouTubeVideoId(url) !== null, "Informe uma URL válida do YouTube.")
      .optional()
  })
  .superRefine((value, context) => {
    if (value.alt !== undefined || value.caption !== undefined) {
      refineCaptionDiffersFromAlt(
        {
          alt: value.alt,
          caption: value.caption === null ? undefined : value.caption
        },
        context
      );
    }
  });

export const reorderGalleryMediaSchema = z.object({
  kind: galleryMediaKindSchema,
  orderedIds: z.array(nonEmptyString).min(1)
});

export const createGalleryPhotoFieldsSchema = z
  .object({
    alt: nonEmptyString.max(MAX_GALLERY_ALT_LENGTH),
    caption: galleryCaptionSchema,
    categorySlug: optionalCategorySlugSchema,
    order: z.coerce.number().int().min(0).max(9999).optional()
  })
  .superRefine(refineCaptionDiffersFromAlt);
