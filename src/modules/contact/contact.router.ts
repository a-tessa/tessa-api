import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { env } from "../../env.js";
import { isEmailConfigured } from "../../lib/mailer.js";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import { rateLimiter } from "../../middlewares/rate-limit.js";
import type { AppBindings } from "../../types.js";
import { sendContactNotificationEmail } from "./contact.email.js";
import {
  listContactNotificationRecipients,
  replaceContactNotificationRecipients
} from "./contact.notification-recipients.service.js";
import {
  serializeContactListResponse,
  serializeContactNotificationRecipientsResponse,
  serializeContactResponse,
  serializeContactStatsResponse
} from "./contact.serializers.js";
import {
  contactIdParamsSchema,
  contactListQuerySchema,
  createContactSchema,
  replaceContactNotificationRecipientsSchema,
  updateContactStatusSchema
} from "./contact.schemas.js";
import {
  createContact,
  deleteContact,
  getContactById,
  getContactStats,
  listContacts,
  updateContactStatus
} from "./contact.service.js";

export const contactRouter = new Hono<AppBindings>();

const submitRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5
});

contactRouter.post("/", submitRateLimit, zValidator("json", createContactSchema), async (c) => {
  const input = c.req.valid("json");
  const contact = await createContact(input);

  try {
    await sendContactNotificationEmail(contact);
  } catch (error) {
    console.error("[contact-email] Falha ao enviar notificação:", error);
  }

  return c.json(serializeContactResponse(contact), 201);
});

contactRouter.use("/admin", requireAuth, requireRole(["MASTER", "ADMIN"]));
contactRouter.use("/admin/*", requireAuth, requireRole(["MASTER", "ADMIN"]));

contactRouter.get(
  "/admin",
  zValidator("query", contactListQuerySchema),
  async (c) => {
    const query = c.req.valid("query");
    const result = await listContacts(query);

    return c.json(serializeContactListResponse(result));
  }
);

contactRouter.get("/admin/stats", async (c) => {
  const stats = await getContactStats();

  return c.json(serializeContactStatsResponse(stats));
});

// Registrado antes de "/admin/:id" para não ser capturado pela rota dinâmica.
contactRouter.get("/admin/notification-recipients", async (c) => {
  const recipients = await listContactNotificationRecipients();

  return c.json(
    serializeContactNotificationRecipientsResponse({
      recipients,
      fallbackEmail: env.CONTACT_NOTIFICATION_EMAIL,
      isEmailDeliveryConfigured: isEmailConfigured()
    })
  );
});

contactRouter.put(
  "/admin/notification-recipients",
  zValidator("json", replaceContactNotificationRecipientsSchema),
  async (c) => {
    const input = c.req.valid("json");
    const recipients = await replaceContactNotificationRecipients(input);

    return c.json(
      serializeContactNotificationRecipientsResponse({
        recipients,
        fallbackEmail: env.CONTACT_NOTIFICATION_EMAIL,
        isEmailDeliveryConfigured: isEmailConfigured()
      })
    );
  }
);

contactRouter.get(
  "/admin/:id",
  zValidator("param", contactIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const contact = await getContactById(id);

    return c.json(serializeContactResponse(contact));
  }
);

contactRouter.patch(
  "/admin/:id/contact-status",
  zValidator("param", contactIdParamsSchema),
  zValidator("json", updateContactStatusSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const contact = await updateContactStatus(id, input);

    return c.json(serializeContactResponse(contact));
  }
);

contactRouter.delete(
  "/admin/:id",
  zValidator("param", contactIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    await deleteContact(id);

    return c.json({ message: "Contato removido." });
  }
);
