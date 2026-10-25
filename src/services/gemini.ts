import { GoogleGenAI } from '@google/genai';
import type { Interactions } from '@google/genai';

/**
 * TALAS — Gemini AI integration service.
 *
 * Security policy:
 *   - No API key is ever hardcoded in source or exposed via `VITE_*` client
 *     environment variables.
 *   - In server/Node environments, `GEMINI_API_KEY` is read from `process.env`.
 *   - In the browser, requests are sent to `/api/gemini-intervention` (local
 *     Vite server middleware) or the backend Lambda endpoint
 *     (`action: "gemini-intervention"`).
 */

function resolveServerApiKey(): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return env?.GEMINI_API_KEY;
}

export const tools: Interactions.Tool[] = [
  {
    type: 'google_search',
  },
];

export const generationConfig = {
  max_output_tokens: 65536,
  thinking_level: 'medium' as const,
};

export const GEMINI_MODEL = 'models/gemini-3.8-flash' as const;

/**
 * Runs a Gemini interaction in a server/Node environment where
 * `process.env.GEMINI_API_KEY` is available.
 */
export async function runGeminiInteraction(input: string) {
  const apiKey = resolveServerApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const interaction = await ai.interactions.create({
    model: GEMINI_MODEL,
    input,
    tools,
    generation_config: generationConfig,
  });

  return interaction;
}

export interface GeminiServerResponse {
  model: string;
  outputText: string;
  text?: string;
}

async function postGeminiEndpoint(
  url: string,
  prompt: string,
  timeoutMs: number,
): Promise<GeminiServerResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'gemini-intervention',
        prompt,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(
        (errBody as { error?: string }).error ??
          `Gemini endpoint (${url}) returned HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as Partial<GeminiServerResponse> & {
      serverTime?: string;
      changes?: unknown[];
    };
    if (typeof data.outputText !== 'string' || !data.outputText.trim()) {
      if (data.serverTime && Array.isArray(data.changes)) {
        throw new Error(
          'AWS Lambda code is still running the old index.mjs. Copy-paste TALAS/backend/index.mjs into the Lambda Code tab and click Deploy.',
        );
      }
      throw new Error('Empty response from Gemini endpoint.');
    }

    return {
      model: data.model ?? GEMINI_MODEL,
      outputText: data.outputText,
      text: data.outputText,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls the backend `gemini-intervention` endpoint from the browser (trying
 * local server middleware `/api/gemini-intervention` first, then the Lambda
 * endpoint `VITE_TALAS_SYNC_URL`, or the Node SDK directly in server tests).
 */
export async function callGeminiInterventionEndpoint(
  prompt: string,
  options?: {
    endpointUrl?: string;
    timeoutMs?: number;
    customTransport?: (prompt: string) => Promise<GeminiServerResponse>;
  },
): Promise<GeminiServerResponse> {
  if (options?.customTransport) {
    return options.customTransport(prompt);
  }

  const timeoutMs = options?.timeoutMs ?? 60_000;

  // 1) If an explicit endpointUrl is passed, use it directly.
  if (options?.endpointUrl) {
    return postGeminiEndpoint(options.endpointUrl, prompt, timeoutMs);
  }

  // 2) In browser environments, try the local server middleware `/api/gemini-intervention` first.
  if (typeof window !== 'undefined') {
    try {
      return await postGeminiEndpoint('/api/gemini-intervention', prompt, timeoutMs);
    } catch {
      // Fall through to configured Lambda URL
    }
  }

  // 3) Configured Lambda / API Gateway URL (`VITE_TALAS_SYNC_URL`)
  const lambdaEndpoint =
    (typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_TALAS_SYNC_URL as string | undefined)
      : undefined) ?? '';

  if (lambdaEndpoint.trim().length > 0) {
    return postGeminiEndpoint(lambdaEndpoint, prompt, timeoutMs);
  }

  // 4) Fallback for Node/server execution when `process.env.GEMINI_API_KEY` is set.
  const serverKey = resolveServerApiKey();
  if (serverKey) {
    const interaction = await runGeminiInteraction(prompt);
    const raw = interaction as { output_text?: string; steps?: Array<{ content?: unknown }> };
    const text =
      raw.output_text ??
      (typeof raw.steps?.at(-1)?.content === 'string'
        ? (raw.steps.at(-1)?.content as string)
        : JSON.stringify(raw.steps?.at(-1) ?? {}));
    return {
      model: GEMINI_MODEL,
      outputText: text,
      text,
    };
  }

  throw new Error('Gemini backend endpoint is not configured.');
}
