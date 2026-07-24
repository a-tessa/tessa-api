import { z } from "zod";

export const instagramPublicListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(3).default(3),
  locale: z.string().optional()
});

export const instagramSelectionInputSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime(),
    primary: z.string().min(1),
    upperRight: z.string().min(1),
    lowerRight: z.string().min(1)
  })
  .superRefine((selection, context) => {
    const mediaIds = [
      selection.primary,
      selection.upperRight,
      selection.lowerRight
    ];

    if (new Set(mediaIds).size !== mediaIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As três posições precisam usar publicações distintas."
      });
    }
  });

export const instagramOAuthCompleteSchema = z
  .object({
    state: z.string().min(1),
    accessToken: z.string().min(1).optional(),
    longLivedToken: z.string().min(1).optional(),
    expiresIn: z.coerce.number().int().positive().optional(),
    dataAccessExpirationTime: z.coerce.number().int().positive().optional()
  })
  .refine(
    (input) => Boolean(input.longLivedToken || input.accessToken),
    "Token OAuth ausente."
  );

export const instagramMediaTypeSchema = z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]);

export const instagramMediaChildSchema = z.object({
  id: z.string().optional(),
  media_type: instagramMediaTypeSchema.optional(),
  media_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional()
});

export const instagramMediaSchema = z.object({
  id: z.string().min(1),
  caption: z.string().optional().nullable(),
  alt_text: z.string().optional().nullable(),
  media_type: instagramMediaTypeSchema,
  media_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
  permalink: z.string().url(),
  timestamp: z.string().min(1),
  children: z
    .object({
      data: z.array(instagramMediaChildSchema).default([])
    })
    .optional()
});

export const instagramMediaListSchema = z.object({
  data: z.array(instagramMediaSchema).default([])
});

export const instagramMeSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  username: z.string().min(1),
  account_type: z.string().optional()
});

export const instagramLongLivedTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.coerce.number().int().positive()
});

export const facebookPageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  instagram_business_account: z
    .object({
      id: z.string().min(1)
    })
    .optional()
});

export const facebookPagesSchema = z.object({
  data: z.array(facebookPageSchema).default([])
});

export type InstagramMediaDto = z.infer<typeof instagramMediaSchema>;
