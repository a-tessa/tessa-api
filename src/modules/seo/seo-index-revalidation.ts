import { waitUntil } from "@vercel/functions";

const REQUEST_TIMEOUT_MS = 3_000;

export interface SeoIndexRevalidationTargetInput {
  landingAppUrl?: string;
  secret?: string;
}

export interface SeoIndexRevalidationTarget {
  landingAppUrl: string;
  secret: string;
}

export interface RequestSeoIndexRevalidationInput extends SeoIndexRevalidationTarget {
  fetchImpl?: typeof fetch;
}

export interface NotifySeoIndexChangedInput extends SeoIndexRevalidationTargetInput {
  fetchImpl?: typeof fetch;
  schedule?: (task: Promise<unknown>) => void;
}

export function resolveSeoIndexRevalidationTarget(
  input: SeoIndexRevalidationTargetInput
): SeoIndexRevalidationTarget | null {
  const landingAppUrl = input.landingAppUrl?.replace(/\/+$/, "") ?? "";
  const secret = input.secret ?? "";

  if (!landingAppUrl || !secret) {
    return null;
  }

  return { landingAppUrl, secret };
}

export async function requestSeoIndexRevalidation(
  input: RequestSeoIndexRevalidationInput
): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${input.landingAppUrl}/api/revalidate-seo-index`, {
      method: "POST",
      headers: {
        "x-revalidate-secret": input.secret
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "seo-index.revalidation.failed",
          status: response.status
        })
      );
    }
  } catch (error: unknown) {
    console.error(
      JSON.stringify({
        event: "seo-index.revalidation.failed",
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}

function runInBackground(task: Promise<unknown>): void {
  const safeTask = task.catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "seo-index.revalidation.failed",
        error: error instanceof Error ? error.message : String(error)
      })
    );
  });

  try {
    waitUntil(safeTask);
  } catch {
    // Not running in a Vercel context (e.g. local dev): the promise still runs.
  }
}

export function notifySeoIndexChanged(config?: NotifySeoIndexChangedInput): void {
  const target = resolveSeoIndexRevalidationTarget(
    config
      ? { landingAppUrl: config.landingAppUrl, secret: config.secret }
      : {
          landingAppUrl: process.env.LANDING_APP_URL,
          secret: process.env.SEO_REVALIDATE_SECRET
        }
  );

  if (!target) {
    console.info(
      JSON.stringify({
        event: "seo-index.revalidation.skipped",
        reason: "not-configured"
      })
    );
    return;
  }

  const schedule = config?.schedule ?? runInBackground;
  schedule(
    requestSeoIndexRevalidation({
      ...target,
      fetchImpl: config?.fetchImpl
    })
  );
}
