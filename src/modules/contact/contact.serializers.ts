import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  ContactDto,
  ContactListResponseDto,
  ContactListResult,
  ContactRecord,
  ContactResponseDto
} from "./contact.types.js";

export function serializeContact(contact: ContactRecord): ContactDto {
  return {
    id: contact.id,
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    companyName: contact.companyName,
    city: contact.city,
    state: contact.state,
    service: contact.service,
    message: contact.message,
    createdAt: contact.createdAt
  };
}

export function serializeContactListResponse(input: ContactListResult): ContactListResponseDto {
  return {
    contacts: input.contacts.map(serializeContact),
    pagination: serializePagination(input.pagination)
  };
}

export function serializeContactResponse(contact: ContactRecord): ContactResponseDto {
  return {
    contact: serializeContact(contact)
  };
}
