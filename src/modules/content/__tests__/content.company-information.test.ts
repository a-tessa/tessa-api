import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companyInformationSchema,
  draftContentSchema,
  MAX_COMPANY_ADDRESS_LENGTH,
  MAX_COMPANY_CNPJ_LENGTH,
  MAX_COMPANY_EMAIL_LENGTH,
  MAX_COMPANY_NAME_LENGTH,
  MAX_COMPANY_PHONE_CONTACTS,
  MAX_COMPANY_PHONE_LENGTH,
  MAX_COMPANY_ZIP_CODE_LENGTH
} from "../content.schemas.js";
import { extractLandingItems } from "../../translation/translation.extract.js";

process.env.TRANSLATION_ENABLED = "false";

const companyInformation = {
  name: "Tessa Tecnologia e Desenvolvimento LTDA",
  cnpj: "00.000.000/0001-00",
  address: "Rodovia Assis Chateaubriand SP 425 KM175.9, Guapiaçu",
  zipCode: "15110-000",
  email: "contato@tessa.com.br",
  phoneContacts: [{ phone: "+55 17 3267-1220" }, { phone: "+55 17 3267-1453" }]
};

describe("companyInformationSchema", () => {
  it("accepts valid institutional contact data and keeps the section optional", () => {
    assert.equal(draftContentSchema.parse({}).companyInformation, undefined);
    assert.deepEqual(
      companyInformationSchema.parse(companyInformation),
      companyInformation
    );
  });

  it("enforces required trimmed fields, email, and phone limits", () => {
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        name: " "
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        email: "not-an-email"
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        phoneContacts: []
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        phoneContacts: Array.from(
          { length: MAX_COMPANY_PHONE_CONTACTS + 1 },
          (_, index) => ({ phone: `+55 17 3267-100${String(index)}` })
        )
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        name: "a".repeat(MAX_COMPANY_NAME_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        cnpj: "1".repeat(MAX_COMPANY_CNPJ_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        address: "a".repeat(MAX_COMPANY_ADDRESS_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        zipCode: "1".repeat(MAX_COMPANY_ZIP_CODE_LENGTH + 1)
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        email: `${"a".repeat(MAX_COMPANY_EMAIL_LENGTH - 3)}@x.y`
      }).success,
      false
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        phoneContacts: [{ phone: "1".repeat(MAX_COMPANY_PHONE_LENGTH + 1) }]
      }).success,
      false
    );
  });

  it("accepts an optional WhatsApp number with DDI digits", () => {
    assert.deepEqual(
      companyInformationSchema.parse({
        ...companyInformation,
        whatsapp: "+55 17 99999-1234"
      }),
      {
        ...companyInformation,
        whatsapp: "+55 17 99999-1234"
      }
    );
    assert.equal(
      companyInformationSchema.safeParse({
        ...companyInformation,
        whatsapp: "123"
      }).success,
      false
    );
  });

  it("does not extract company information for translation", () => {
    assert.deepEqual(extractLandingItems({ companyInformation }), []);
  });
});
