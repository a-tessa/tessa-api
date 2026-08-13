import { serializePagination } from "../shared/pagination.serializers.js";
import type {
  ContactDto,
  ContactListResponseDto,
  ContactListResult,
  ContactNotificationRecipientDto,
  ContactNotificationRecipientRecord,
  ContactNotificationRecipientsResponseDto,
  ContactRecord,
  ContactResponseDto,
  ContactStatsDto,
  ContactStatsRecord,
  ContactStatsResponseDto
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
    hasBeenContacted: contact.hasBeenContacted,
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

export function serializeContactStats(stats: ContactStatsRecord): ContactStatsDto {
  return {
    totalContacts: stats.totalContacts,
    respondedContacts: stats.respondedContacts
  };
}

export function serializeContactStatsResponse(stats: ContactStatsRecord): ContactStatsResponseDto {
  return {
    stats: serializeContactStats(stats)
  };
}

export function serializeContactNotificationRecipient(
  recipient: ContactNotificationRecipientRecord
): ContactNotificationRecipientDto {
  return {
    id: recipient.id,
    email: recipient.email,
    name: recipient.name
  };
}

export function serializeContactNotificationRecipientsResponse(input: {
  recipients: ContactNotificationRecipientRecord[];
  fallbackEmail: string;
  isEmailDeliveryConfigured: boolean;
}): ContactNotificationRecipientsResponseDto {
  return {
    recipients: input.recipients.map(serializeContactNotificationRecipient),
    fallbackEmail: input.fallbackEmail,
    isEmailDeliveryConfigured: input.isEmailDeliveryConfigured
  };
}
