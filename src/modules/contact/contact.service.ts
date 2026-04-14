import { notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import type {
  ContactListQuery,
  ContactListResult,
  ContactRecord,
  ContactStatsRecord,
  CreateContactInput,
  UpdateContactStatusInput
} from "./contact.types.js";

const contactSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  companyName: true,
  city: true,
  state: true,
  service: true,
  message: true,
  hasBeenContacted: true,
  createdAt: true
} as const;

export async function createContact(input: CreateContactInput): Promise<ContactRecord> {
  return prisma.contact.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      city: input.city,
      state: input.state,
      service: input.service ?? null,
      message: input.message ?? null
    },
    select: contactSelect
  });
}

export async function listContacts(query: ContactListQuery): Promise<ContactListResult> {
  const skip = (query.page - 1) * query.perPage;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      skip,
      take: query.perPage,
      orderBy: { createdAt: "desc" },
      select: contactSelect
    }),
    prisma.contact.count()
  ]);

  return {
    contacts,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      total
    }
  };
}

export async function getContactById(id: string): Promise<ContactRecord> {
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: contactSelect
  });

  if (!contact) {
    notFound("Contato não encontrado.");
  }

  return contact;
}

export async function updateContactStatus(
  id: string,
  input: UpdateContactStatusInput
): Promise<ContactRecord> {
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!contact) {
    notFound("Contato não encontrado.");
  }

  return prisma.contact.update({
    where: { id },
    data: {
      hasBeenContacted: input.hasBeenContacted
    },
    select: contactSelect
  });
}

export async function getContactStats(): Promise<ContactStatsRecord> {
  const [totalContacts, respondedContacts] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({
      where: {
        hasBeenContacted: true
      }
    })
  ]);

  return {
    totalContacts,
    respondedContacts
  };
}

export async function deleteContact(id: string): Promise<void> {
  const contact = await prisma.contact.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!contact) {
    notFound("Contato não encontrado.");
  }

  await prisma.contact.delete({ where: { id } });
}
