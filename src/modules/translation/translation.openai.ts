import { Output, generateText } from "ai";
import { z } from "zod";
import { env } from "../../env.js";
import { getOpenAIProvider } from "../../lib/ai.js";
import { PLAIN_BATCH_SIZE, TRANSLATION_DOMAIN, TRANSLATION_GLOSSARY } from "./translation.config.js";
import type { TargetLocale, TranslatableItem, TranslationMap } from "./translation.types.js";

const LOCALE_LABEL: Record<TargetLocale, string> = {
  en: "English (en-US)",
  es: "Spanish (neutral Latin American Spanish)"
};

function buildGlossaryBlock(target: TargetLocale): string {
  const lines = TRANSLATION_GLOSSARY.map((entry) => {
    if (entry.keepAsIs) {
      return `- "${entry.term}": keep unchanged (do not translate)`;
    }
    const rendering = target === "en" ? entry.en : entry.es;
    return `- "${entry.term}" => "${rendering}"`;
  });

  return lines.join("\n");
}

function buildSystemPrompt(target: TargetLocale): string {
  const label = LOCALE_LABEL[target];

  return [
    `You are a professional localizer specialized in ${TRANSLATION_DOMAIN}.`,
    `Translate the user's strings from Brazilian Portuguese (pt-BR) into ${label}.`,
    "",
    "Rules:",
    `- Produce natural, idiomatic and fluent ${label}. Never translate word-for-word.`,
    "- Use the correct technical terminology of the industry in the target language.",
    "- Apply this glossary exactly:",
    buildGlossaryBlock(target),
    "- Preserve the meaning, tone and marketing intent of the original.",
    "- Do NOT translate or alter: URLs, e-mail addresses, phone numbers, CNPJ, numeric values, code or slugs.",
    "- Keep placeholders and formatting intact.",
    "- Return a translation for every item, keeping the provided id exactly."
  ].join("\n");
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

async function translatePlainItems(
  items: TranslatableItem[],
  target: TargetLocale,
  system: string,
  result: TranslationMap
): Promise<void> {
  const provider = getOpenAIProvider();
  if (!provider) {
    throw new Error("OpenAI provider não configurado.");
  }

  for (const batch of chunk(items, PLAIN_BATCH_SIZE)) {
    const { output } = await generateText({
      model: provider(env.OPENAI_TRANSLATION_MODEL),
      system,
      output: Output.array({
        element: z.object({
          id: z.string(),
          text: z.string()
        })
      }),
      prompt: [
        'Translate the "text" of each item below. Return one object per item with',
        'the SAME "id" and the translated "text".',
        "",
        JSON.stringify(batch.map(({ id, text }) => ({ id, text })))
      ].join("\n")
    });

    for (const entry of output) {
      result[entry.id] = entry.text;
    }
  }
}

async function translateHtmlItem(
  item: TranslatableItem,
  target: TargetLocale,
  system: string,
  result: TranslationMap
): Promise<void> {
  const provider = getOpenAIProvider();
  if (!provider) {
    throw new Error("OpenAI provider não configurado.");
  }

  const { output } = await generateText({
    model: provider(env.OPENAI_TRANSLATION_MODEL),
    system: [
      system,
      "",
      "The content below is HTML. Preserve ALL tags, attributes, structure and",
      "URLs exactly. Translate only the human-visible text and the values of alt",
      "and title attributes."
    ].join("\n"),
    output: Output.object({
      schema: z.object({
        text: z.string()
      })
    }),
    prompt: item.text
  });

  result[item.id] = output.text;
}

/**
 * Sends content to be translated by OpenAI following the project's localization
 * criteria (technical terminology preserved, natural — not literal — output).
 * Returns a map of TranslatableItem.id -> translated string.
 */
export async function translateContent(
  items: TranslatableItem[],
  target: TargetLocale
): Promise<TranslationMap> {
  const result: TranslationMap = {};

  if (items.length === 0) {
    return result;
  }

  const system = buildSystemPrompt(target);
  const plainItems = items.filter((item) => item.format === "plain");
  const htmlItems = items.filter((item) => item.format === "html");

  if (plainItems.length > 0) {
    await translatePlainItems(plainItems, target, system, result);
  }

  for (const item of htmlItems) {
    await translateHtmlItem(item, target, system, result);
  }

  return result;
}
