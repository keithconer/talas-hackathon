/**
 * TALAS — sync engine (offline/online, last-write-wins).
 *
 * One round trip per sync: push all local `dirty` records, pull everything the
 * server changed since the last pull, and reconcile with last-write-wins by
 * `updatedAt`. IndexedDB stays the source of truth; the UI never blocks on this.
 *
 * Flow of `sync()`:
 *   1. Guard against concurrent runs (in-flight flag in syncState).
 *   2. Collect dirty records across all entity stores -> changes[].
 *   3. POST { since, changes } to the backend.
 *   4. Apply server changes locally using LWW (newer updatedAt wins).
 *   5. Clear `dirty` / stamp `syncedAt` on records we successfully pushed,
 *      unless a newer local edit landed meanwhile.
 *   6. Persist serverTime as the new `since`.
 * On any failure, dirty records are left dirty for the next attempt.
 */

import { getAll, get, put, getSyncState, setSyncState } from "./db";
import { STORE_NAMES, SYNC_KEYS } from "./types";
import type {
  Entity,
  StoreName,
  SyncChange,
  SyncRequest,
  SyncResponse,
} from "./types";
import { isSyncConfigured, postSync, SyncError } from "./api";

/** Outcome of a sync attempt, returned to callers (UI status, etc.). */
export interface SyncResult {
  status: "ok" | "skipped" | "error";
  pushed: number;
  pulled: number;
  serverTime?: string;
  reason?: string;
}

/**
 * Flags every local record across all entity stores as `dirty` so the next
 * `sync()` pushes the full local dataset to the backend. Useful to seed the
 * cloud from existing local data (e.g. records seeded before sync existed).
 * Returns the number of records marked.
 */
export async function markAllDirty(): Promise<number> {
  let marked = 0;
  for (const store of STORE_NAMES) {
    const all = await getAll(store);
    for (const record of all) {
      if (record.dirty === true) continue;
      await put(store, { ...record, dirty: true });
      marked += 1;
    }
  }
  return marked;
}

/** Compares two ISO timestamps; returns true if `a` is strictly newer than `b`. */
function isNewer(a: string | undefined, b: string | undefined): boolean {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  return ta > tb;
}

/** Gathers every dirty record across entity stores as sync changes. */
async function collectDirty(): Promise<{
  changes: SyncChange[];
  /** Snapshot of pushed records' updatedAt, keyed `${store}:${id}`. */
  pushedVersions: Map<string, string | undefined>;
}> {
  const changes: SyncChange[] = [];
  const pushedVersions = new Map<string, string | undefined>();

  for (const store of STORE_NAMES) {
    const all = await getAll(store);
    for (const record of all) {
      if (record.dirty !== true) continue;
      changes.push({
        store,
        op: record.deleted === true ? "delete" : "put",
        record,
      });
      pushedVersions.set(`${store}:${record.id}`, record.updatedAt);
    }
  }

  return { changes, pushedVersions };
}

/** Applies one incoming server change using last-write-wins. */
async function applyIncoming(change: SyncChange): Promise<boolean> {
  const store = change.store as StoreName;
  const incoming = change.record;
  const local = await get(store, incoming.id);

  // LWW: only accept the server record if it is strictly newer than local.
  // Ties keep the local copy (avoids clobbering an identical-timestamp edit).
  if (local && !isNewer(incoming.updatedAt, local.updatedAt)) {
    return false;
  }

  // Incoming records are authoritative and already in sync with the server.
  const merged: Entity = {
    ...incoming,
    deleted: change.op === "delete" ? true : incoming.deleted,
    dirty: false,
    syncedAt: new Date().toISOString(),
  };
  await put(store, merged);
  return true;
}

/**
 * Clears the `dirty` flag on a record we pushed — but only if it has not been
 * edited again since we snapshotted it (its updatedAt still matches). This
 * avoids losing a local edit that happened mid-sync.
 */
async function markPushedClean(
  store: StoreName,
  id: string,
  pushedUpdatedAt: string | undefined,
): Promise<void> {
  const current = await get(store, id);
  if (!current) return;
  if (current.updatedAt !== pushedUpdatedAt) return; // edited again; keep dirty

  await put(store, {
    ...current,
    dirty: false,
    syncedAt: new Date().toISOString(),
  });
}

/**
 * Runs a full sync cycle. Safe to call anytime; returns a {@link SyncResult}.
 * Never throws — transport failures are reported via `status: "error"`.
 */
export async function sync(): Promise<SyncResult> {
  if (!isSyncConfigured()) {
    return { status: "skipped", pushed: 0, pulled: 0, reason: "no-endpoint" };
  }

  // Concurrency guard. The flag lives in syncState so overlapping triggers
  // (load + reconnect + button) don't double-sync. It stores the start time so
  // a flag left behind by an interrupted sync (e.g. page reload mid-request)
  // self-heals after STALE_LOCK_MS instead of blocking sync forever.
  const STALE_LOCK_MS = 30_000;
  const inFlightAt = await getSyncState<string>(SYNC_KEYS.inFlight);
  if (inFlightAt) {
    const startedMs = Date.parse(inFlightAt);
    const fresh =
      !Number.isNaN(startedMs) && Date.now() - startedMs < STALE_LOCK_MS;
    if (fresh) {
      return { status: "skipped", pushed: 0, pulled: 0, reason: "in-flight" };
    }
    // Otherwise the lock is stale — fall through and take it over.
    console.warn("[TALAS sync] clearing stale in-flight lock from", inFlightAt);
  }
  await setSyncState(SYNC_KEYS.inFlight, new Date().toISOString());

  try {
    const since =
      (await getSyncState<string>(SYNC_KEYS.lastPulledAt)) ?? null;
    const { changes, pushedVersions } = await collectDirty();

    const request: SyncRequest = { since, changes };
    const response: SyncResponse = await postSync(request);

    // Apply pulled server changes (LWW).
    let pulled = 0;
    for (const change of response.changes) {
      if (await applyIncoming(change)) pulled += 1;
    }

    // Mark successfully pushed records clean (unless edited again meanwhile).
    for (const change of changes) {
      const key = `${change.store}:${change.record.id}`;
      await markPushedClean(
        change.store,
        change.record.id,
        pushedVersions.get(key),
      );
    }

    // Advance the pull cursor to the server's clock.
    await setSyncState(SYNC_KEYS.lastPulledAt, response.serverTime);

    return {
      status: "ok",
      pushed: changes.length,
      pulled,
      serverTime: response.serverTime,
    };
  } catch (err) {
    const reason =
      err instanceof SyncError ? `${err.kind}: ${err.message}` : String(err);
    return { status: "error", pushed: 0, pulled: 0, reason };
  } finally {
    // Release the lock (empty string = not in flight).
    await setSyncState(SYNC_KEYS.inFlight, "");
  }
}
