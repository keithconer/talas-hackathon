/**
 * TALAS — sync controller & React bindings (offline/online sync).
 *
 * Wraps the raw `sync()` engine with observable status so the UI can show a
 * "Syncing… / Last synced … / Error" indicator and a "Sync now" button, and
 * wires automatic triggers (app load + reconnect).
 */

import { useEffect, useState } from "react";
import { sync } from "./sync";
import type { SyncResult } from "./sync";
import { isOnline, onOnline } from "./online";

export type SyncPhase = "idle" | "syncing" | "error";

export interface SyncStatus {
  phase: SyncPhase;
  /** ISO time of the last successful sync, if any. */
  lastSyncedAt?: string;
  /** Human-readable reason when phase is "error". */
  error?: string;
  /** Records pushed/pulled on the last successful sync. */
  lastResult?: SyncResult;
}

let status: SyncStatus = { phase: "idle" };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  for (const l of listeners) l(status);
}

/** Current snapshot of sync status. */
export function getSyncStatus(): SyncStatus {
  return status;
}

/** Subscribe to sync-status changes. Returns an unsubscribe function. */
export function onSyncStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Triggers a sync and updates observable status. Returns the result. Safe to
 * call from a button handler, on load, or on reconnect; the engine's in-flight
 * guard prevents overlap.
 */
export async function syncNow(): Promise<SyncResult> {
  setStatus({ phase: "syncing", error: undefined });
  const result = await sync();

  if (result.status === "ok") {
    setStatus({
      phase: "idle",
      lastSyncedAt: result.serverTime ?? new Date().toISOString(),
      lastResult: result,
      error: undefined,
    });
  } else if (result.status === "skipped") {
    // Nothing to do (no endpoint / already running). Stay idle.
    setStatus({ phase: "idle", lastResult: result });
  } else {
    setStatus({ phase: "error", error: result.reason });
  }

  return result;
}

let started = false;

/**
 * Installs automatic sync triggers exactly once:
 *   - an initial sync on startup if currently online,
 *   - a sync whenever connectivity is regained.
 * Returns an unsubscribe for the reconnect listener.
 */
export function startAutoSync(): () => void {
  if (started) return () => {};
  started = true;

  if (isOnline()) {
    void syncNow();
  }

  return onOnline(() => {
    void syncNow();
  });
}

/** React hook exposing live sync status plus a `syncNow` trigger. */
export function useSyncStatus(): SyncStatus & { syncNow: typeof syncNow } {
  const [snapshot, setSnapshot] = useState<SyncStatus>(getSyncStatus());

  useEffect(() => onSyncStatus(setSnapshot), []);

  return { ...snapshot, syncNow };
}
