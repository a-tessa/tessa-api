import { z } from "zod";
import type { PaginationMetaDto, PaginationState } from "../shared/pagination.types.js";
import {
  contactIdParamsSchema,
  contactListQuerySchema,
  createContactSchema,
  updateContactStatusSchema
} from "./contact.schemas.js";

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type ContactListQuery = z.infer<typeof contactListQuerySchema>;
export type ContactIdParams = z.infer<typeof contactIdParamsSchema>;
export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;

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
