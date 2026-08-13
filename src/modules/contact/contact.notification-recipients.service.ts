import { prisma } from "../../lib/prisma.js";
import type {
  ContactNotificationRecipientRecord,
  ReplaceContactNotificationRecipientsInput
} from "./contact.types.js";

const recipientSelect = {
  id: true,
  email: true,
  name: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true
} as const;

const recipientOrderBy = [{ sortOrder: "asc" }, { createdAt: "asc" }] as const;

export async function listContactNotificationRecipients(): Promise<
  ContactNotificationRecipientRecord[]
> {
  return prisma.contactNotificationRecipient.findMany({
    orderBy: [...recipientOrderBy],
    select: recipientSelect
  });
}

/**
 * Substitui a lista inteira: o admin edita todos os destinatários em um único
 * formulário. Endereços mantidos preservam o `createdAt` original.
 */
export async function replaceContactNotificationRecipients(
  input: ReplaceContactNotificationRecipientsInput
): Promise<ContactNotificationRecipientRecord[]> {
  const emails = input.recipients.map((recipient) => recipient.email);

  return prisma.$transaction(async (tx) => {
    if (emails.length === 0) {
      await tx.contactNotificationRecipient.deleteMany();
    } else {
      await tx.contactNotificationRecipient.deleteMany({
        where: { email: { notIn: emails } }
      });
    }

    for (const [index, recipient] of input.recipients.entries()) {
      await tx.contactNotificationRecipient.upsert({
        where: { email: recipient.email },
        update: { name: recipient.name, sortOrder: index },
        create: { email: recipient.email, name: recipient.name, sortOrder: index }
      });
    }

    return tx.contactNotificationRecipient.findMany({
      orderBy: [...recipientOrderBy],
      select: recipientSelect
    });
  });
}
