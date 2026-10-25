# TALAS — Offline / Online (Local-First Sync)

TALAS is **local-first**: the UI always reads and writes IndexedDB, so the app
works with no network. When a connection is available it syncs with the backend
(`POST /sync`). The network only decides *whether a background sync runs* — it
never blocks the UI.

## How it fits together

```
UI ──> repository.ts (single write path: stamps updatedAt + dirty)
          │
          ▼
      IndexedDB  ◄── source of truth for the UI
          ▲
          │
   sync.ts (push dirty / pull changes, last-write-wins)
          │
      api.ts ──> POST /sync ──> API Gateway / Lambda `talasFunction` ──> DynamoDB
```

| File | Responsibility |
|------|----------------|
| `src/data/types.ts` | Domain contracts + `SyncMeta` + sync protocol types + `STORES` / `syncState`. |
| `src/data/db.ts` | Low-level IndexedDB wrapper (v2 adds the `syncState` key-value store). |
| `src/data/repository.ts` | The write path. `save()` and `softDelete()` stamp `updatedAt` + `dirty`; reads hide tombstones. |
| `src/data/online.ts` | `isOnline()`, `onOnline()`, `useOnline()` React hook. |
| `src/data/api.ts` | `postSync()` HTTPS client + `SyncError`. Reads `VITE_TALAS_SYNC_URL`. |
| `src/data/sync.ts` | The engine: push + pull + last-write-wins reconciliation. |
| `src/data/syncController.ts` | Observable status, `syncNow()`, `startAutoSync()`, `useSyncStatus()`. |

## Configuration

Set the sync endpoint in `.env` (copy `.env.example`):

```
VITE_TALAS_SYNC_URL=https://<id>.lambda-url.ap-southeast-2.on.aws/
```

If this is **unset**, the app runs fully offline and sync is skipped gracefully
(`sync()` returns `{ status: "skipped", reason: "no-endpoint" }`).

## Sync protocol

The client sends one request per sync cycle.

**Request** — `POST /sync`:

```jsonc
{
  "since": "2026-10-03T09:00:00.000Z", // last successful pull, or null on first sync
  "changes": [
    { "store": "learners", "op": "put",    "record": { "id": "...", "updatedAt": "...", /* ... */ } },
    { "store": "learners", "op": "delete", "record": { "id": "...", "updatedAt": "..." } }
  ]
}
```

**Response**:

```jsonc
{
  "serverTime": "2026-10-03T10:00:00.000Z", // becomes the client's new `since`
  "changes": [
    { "store": "assessments", "op": "put", "record": { "id": "...", "updatedAt": "...", /* ... */ } }
  ]
}
```

Stores are the entity stores: `learners`, `teachers`, `assessments`,
`assignments`. Every record carries `updatedAt` (ISO-8601).

## Conflict resolution — last-write-wins

When the same record changed on both sides, the copy with the newer `updatedAt`
wins. On a tie, the local copy is kept. The server's `serverTime` is trusted as
the authoritative clock and stored as the next `since` cursor.

> **Tradeoff:** last-write-wins can silently drop a concurrent edit to the same
> record. This is acceptable for the hackathon demo. For production, consider
> field-level merging or a conflict queue.

## When sync runs

- On app load, if online (`startAutoSync()` in `main.tsx`).
- Automatically when connectivity is regained (`onOnline`).
- Manually via `syncNow()` — wire this to a "Sync now" button.

A concurrency guard (`inFlight` flag in `syncState`) prevents overlapping runs.

## Offline loading (PWA)

`vite-plugin-pwa` (configured in `vite.config.ts`, `registerType: 'autoUpdate'`)
precaches the built app shell and static assets, so TALAS loads with no network
after the first visit. API calls are network-only — data lives in IndexedDB, not
the service-worker cache.

## Security note

The demo endpoint has **no auth**. `api.ts` includes a
`setAuthTokenProvider()` hook that adds an `Authorization: Bearer <token>`
header. Wire it to Cognito/JWT and lock the endpoint down before production.

## Using it from UI code

```ts
import { save, list, softDelete, useOnline, useSyncStatus } from "./data";

await save("learners", { id: "l9", name: "Nia", createdAt: new Date().toISOString() });
const learners = await list("learners");      // tombstones hidden
await softDelete("learners", "l9");

// In a component:
const online = useOnline();
const { phase, lastSyncedAt, syncNow } = useSyncStatus();
```

## Testing

`npm test` runs the Vitest suite (uses `fake-indexeddb`), covering the schema,
seeding, the repository write path, and the sync engine's last-write-wins,
delete propagation, dirty-flag handling, and no-op behavior.
