import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middlewares/auth.js";
import type { AppBindings } from "../../types.js";
import { serializeContactListResponse, serializeContactResponse } from "./contact.serializers.js";
import { contactIdParamsSchema, contactListQuerySchema, createContactSchema } from "./contact.schemas.js";
import { createContact, deleteContact, getContactById, listContacts } from "./contact.service.js";

export const contactRouter = new Hono<AppBindings>();

contactRouter.post("/", zValidator("json", createContactSchema), async (c) => {
  const input = c.req.valid("json");
  const contact = await createContact(input);

  return c.json(serializeContactResponse(contact), 201);
});

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

contactRouter.get(
  "/admin/:id",
  zValidator("param", contactIdParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");
    const contact = await getContactById(id);

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
