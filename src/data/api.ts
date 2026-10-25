/**
 * TALAS — HTTPS sync client (offline/online sync).
 *
 * Thin `fetch` wrapper that talks to the backend `POST /sync` endpoint
 * (AWS Lambda `talasFunction` via API Gateway / Function URL). The URL comes
 * from the `VITE_TALAS_SYNC_URL` env var.
 *
 * No auth today (open endpoint for the demo). An `Authorization` header hook is
 * left in place so Cognito/JWT can be added later without touching callers.
 */

import type { SyncRequest, SyncResponse } from "./types";

/** The configured sync endpoint, or empty string if unset. */
const SYNC_URL: string = import.meta.env.VITE_TALAS_SYNC_URL ?? "";

/** Default per-request timeout (ms). */
const DEFAULT_TIMEOUT_MS = 15_000;

/** Error thrown for any sync transport/protocol failure. */
export class SyncError extends Error {
  /** HTTP status if the failure came from a response, else undefined. */
  readonly status?: number;
  /** "config" | "network" | "timeout" | "http" | "parse" */
  readonly kind: SyncErrorKind;

  constructor(message: string, kind: SyncErrorKind, status?: number) {
    super(message);
    this.name = "SyncError";
    this.kind = kind;
    this.status = status;
  }
}

export type SyncErrorKind = "config" | "network" | "timeout" | "http" | "parse";

/** True if a sync endpoint is configured. Lets callers skip sync gracefully. */
export function isSyncConfigured(): boolean {
  return SYNC_URL.trim().length > 0;
}

/**
 * Optional bearer token provider. No-op today; wire this to your auth layer
 * later and the client will start sending `Authorization: Bearer <token>`.
 */
let authTokenProvider: (() => string | undefined) | null = null;

/** Registers a function that returns the current auth token (or undefined). */
export function setAuthTokenProvider(
  provider: (() => string | undefined) | null,
): void {
  authTokenProvider = provider;
}

function buildHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = authTokenProvider?.();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Sends a sync request to the backend and returns the parsed response.
 * Throws {@link SyncError} on config, network, timeout, HTTP, or parse failure.
 */
export async function postSync(
  request: SyncRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<SyncResponse> {
  if (!isSyncConfigured()) {
    throw new SyncError(
      "VITE_TALAS_SYNC_URL is not set; cannot reach the sync endpoint.",
      "config",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  console.info("[TALAS sync] POST", SYNC_URL, request);

  let response: Response;
  try {
    response = await fetch(SYNC_URL, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    // Surface the REAL underlying error (CORS, DNS, mixed-content, etc.).
    // fetch() rejects with an opaque TypeError on CORS failures, so the detail
    // here plus the browser's own console message is what pinpoints the cause.
    console.error("[TALAS sync] fetch failed:", err);
    throw new SyncError(
      aborted
        ? "Sync request timed out."
        : `Network/CORS error during sync: ${err instanceof Error ? err.message : String(err)}`,
      aborted ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    console.error("[TALAS sync] HTTP", response.status, response.statusText);
    throw new SyncError(
      `Sync endpoint returned HTTP ${response.status}.`,
      "http",
      response.status,
    );
  }

  try {
    const parsed = (await response.json()) as SyncResponse;
    console.info("[TALAS sync] OK", parsed);
    return parsed;
  } catch {
    throw new SyncError("Failed to parse sync response JSON.", "parse");
  }
}

/**
 * Fetches EVERYTHING currently stored in the backend (DynamoDB), ignoring the
 * local sync cursor. Used by the "Cloud" view to show the table contents
 * directly. Returns the raw sync changes (one per stored record).
 */
export async function fetchAllFromCloud(): Promise<SyncResponse> {
  return postSync({ since: null, changes: [] });
}
