import { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  contactIdParamsSchema,
  contactListQuerySchema,
  createContactSchema,
  replaceContactNotificationRecipientsSchema,
  updateContactStatusSchema
} from "./contact.schemas.js";

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
export type ContactIdParams = z.infer<typeof contactIdParamsSchema>;
export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;
export type ReplaceContactNotificationRecipientsInput = z.infer<
  typeof replaceContactNotificationRecipientsSchema
>;

export type ContactRecord = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  service: string | null;
  message: string | null;
  hasBeenContacted: boolean;
  createdAt: Date;
};

export type ContactDto = ContactRecord;

export type ContactListResult = {
  contacts: ContactRecord[];
  pagination: PaginationState;
};

export type ContactListResponseDto = {
  contacts: ContactDto[];
  pagination: PaginationMetaDto;
};

export type ContactResponseDto = {
  contact: ContactDto;
};

export type ContactStatsRecord = {
  totalContacts: number;
  respondedContacts: number;
};

export type ContactStatsDto = ContactStatsRecord;

export type ContactStatsResponseDto = {
  stats: ContactStatsDto;
};

export type ContactNotificationRecipientRecord = {
  id: string;
  email: string;
  name: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactNotificationRecipientDto = {
  id: string;
  email: string;
  name: string | null;
};

export type SuggestedContactNotificationUserRecord = {
  id: string;
  name: string;
  email: string;
};

export type SuggestedContactNotificationUserDto = SuggestedContactNotificationUserRecord;

/**
 * `fallbackEmail` é o destino usado enquanto a lista está vazia, definido por
 * `CONTACT_NOTIFICATION_EMAIL`. `isEmailDeliveryConfigured` indica se o
 * ambiente consegue de fato enviar e-mails. `suggestedUsers` são os usuários
 * ativos do admin, oferecidos como atalho ao montar a lista.
 */
export type ContactNotificationRecipientsResponseDto = {
  recipients: ContactNotificationRecipientDto[];
  suggestedUsers: SuggestedContactNotificationUserDto[];
  fallbackEmail: string;
  isEmailDeliveryConfigured: boolean;
};
