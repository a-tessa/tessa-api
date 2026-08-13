import { z } from "zod";

const nonEmptyString = z.string().trim().min(1);

const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

export const createContactSchema = z.object({
  fullName: nonEmptyString.max(200),
  email: z.string().email(),
  phone: nonEmptyString.max(30),
  companyName: nonEmptyString.max(200),
  city: nonEmptyString.max(100),
  state: z.enum(BR_STATES),
  service: z.string().trim().max(200).nullish(),
  message: z.string().trim().max(2000).nullish()
});

export const contactListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
});

export const contactIdParamsSchema = z.object({
  id: nonEmptyString
});

export const updateContactStatusSchema = z.object({
  hasBeenContacted: z.boolean()
});

export const MAX_CONTACT_NOTIFICATION_RECIPIENTS = 10;
export const MAX_CONTACT_NOTIFICATION_RECIPIENT_NAME_LENGTH = 120;
export const MAX_CONTACT_NOTIFICATION_RECIPIENT_EMAIL_LENGTH = 255;

export const contactNotificationRecipientInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido.")
    .max(MAX_CONTACT_NOTIFICATION_RECIPIENT_EMAIL_LENGTH),
  name: z
    .string()
    .trim()
    .max(MAX_CONTACT_NOTIFICATION_RECIPIENT_NAME_LENGTH)
    .nullish()
    .transform((value) => (value && value.length > 0 ? value : null))
});

export const replaceContactNotificationRecipientsSchema = z.object({
  recipients: z
    .array(contactNotificationRecipientInputSchema)
    .max(MAX_CONTACT_NOTIFICATION_RECIPIENTS)
    .superRefine((recipients, ctx) => {
      const seen = new Set<string>();

      recipients.forEach((recipient, index) => {
        if (seen.has(recipient.email)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "email"],
            message: "Este e-mail já está na lista."
          });
          return;
        }

        seen.add(recipient.email);
      });
    })
});
