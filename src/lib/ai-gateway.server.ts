// Server-only Lovable AI Gateway helpers (keys never reach the browser).
import { createOpenAI } from '@ai-sdk/openai';

export const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1';
export const TEXT_MODEL = 'openai/gpt-6-astra';
export const IMAGE_MODEL = 'openai/gpt-image-2.5-sunburst';

const LOVABLE_AIG_RUN_ID_HEADER = 'X-Lovable-AIG-Run-ID';

/** Resends the gateway-issued run id on follow-up calls of the same job; never mints one. */
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      const response = await fetch(input, { ...init, headers });
      runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
      return response;
    },
  };
}

/** Responses provider, created per job run. */
export function createResponsesProvider(apiKey: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  return createOpenAI({
    baseURL: AI_GATEWAY_URL,
    apiKey,
    headers: { 'Lovable-API-Key': apiKey, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: runIdFetch.fetch,
  });
}

/** Gateway failure with the status that decides whether a later run may retry it. */
export class AiGatewayError extends Error {
  constructor(message: string, readonly status: number | null, readonly terminal: boolean) {
    super(message);
  }
}

/** Only 429 / 5xx / network failures are retryable; everything else (credits, denials, refusals, bad requests) is terminal. */
export function classifyAiError(e: unknown): AiGatewayError {
  if (e instanceof AiGatewayError) return e;
  const status = typeof (e as { statusCode?: unknown })?.statusCode === 'number' ? (e as { statusCode: number }).statusCode : null;
  const message = e instanceof Error ? e.message : String(e);
  const retryable = status === null ? !/NoObjectGenerated|No object generated|refus/i.test(`${(e as Error)?.name} ${message}`) : status === 429 || status >= 500;
  return new AiGatewayError(message, status, !retryable);
}
