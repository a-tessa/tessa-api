import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTalentApplicationSchema } from "../talent-application.schemas.js";

const validApplication = {
  fullName: "Ana Souza",
  email: "ana@example.com",
  phone: "(17) 99999-0000",
  educationLevel: "Ensino Superior completo",
  education: "Engenharia de Produção",
  practiceArea: "Produção",
  professionalSummary: "Experiência em linha de produção de estruturas metálicas."
};

describe("createTalentApplicationSchema", () => {
  it("aceita o cadastro do banco de talentos", () => {
    const parsed = createTalentApplicationSchema.parse(validApplication);
    assert.equal(parsed.practiceArea, "Produção");
  });

  it("aceita telefone com 8 ou 9 dígitos", () => {
    for (const phone of ["(17) 3267-1220", "(11) 9999-9999", "(11) 99999-1234", "(11) 32671-1220"]) {
      const parsed = createTalentApplicationSchema.parse({
        ...validApplication,
        phone
      });
      assert.equal(parsed.phone, phone);
    }
  });

  it("rejeita e-mail sem domínio e celular incompleto", () => {
    const result = createTalentApplicationSchema.safeParse({
      ...validApplication,
      email: "ana@example",
      phone: "(17) 9999-000"
    });
    assert.equal(result.success, false);
  });

  it("rejeita uma área de atuação fora da lista", () => {
    const result = createTalentApplicationSchema.safeParse({
      ...validApplication,
      practiceArea: "Jurídico"
    });
    assert.equal(result.success, false);
  });
});
