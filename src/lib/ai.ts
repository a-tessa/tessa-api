import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import { env } from "../env.js";

let cachedProvider: OpenAIProvider | null = null;

/**
 * Returns a configured OpenAI provider, or null when no API key is available.
 * Translation features degrade gracefully (fallback to pt-BR) when this is null.
 */
export function getOpenAIProvider(): OpenAIProvider | null {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  cachedProvider ??= createOpenAI({ apiKey: env.OPENAI_API_KEY });
  return cachedProvider;
}

export function isTranslationConfigured(): boolean {
  return env.TRANSLATION_ENABLED && Boolean(env.OPENAI_API_KEY);
}
