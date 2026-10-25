/**
 * TALAS — on-screen offline/online + sync indicator.
 *
 * A small, self-contained widget for the demo. Shows connectivity, the current
 * sync phase, the last-synced time, and a "Sync now" button. Reads everything
 * from the data layer's hooks — no props required.
 */

import { markAllDirty, useOnline, useSyncStatus } from "../data";
import "./SyncIndicator.css";

/** Marks all local records dirty, then syncs — pushes everything to the cloud. */
async function pushAll(syncNow: () => Promise<unknown>): Promise<void> {
  await markAllDirty();
  await syncNow();
}

function formatTime(iso?: string): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "never";
  return d.toLocaleTimeString();
}

export function SyncIndicator() {
  const online = useOnline();
  const { phase, lastSyncedAt, error, lastResult, syncNow } = useSyncStatus();

  const phaseLabel =
    phase === "syncing"
      ? "Syncing…"
      : phase === "error"
        ? "Sync error"
        : "Idle";

  return (
    <div className="sync-indicator" role="status" aria-live="polite">
      <span
        className={`sync-dot ${online ? "is-online" : "is-offline"}`}
        aria-hidden="true"
      />
      <span className="sync-net">{online ? "Online" : "Offline"}</span>

      <span className="sync-sep" aria-hidden="true">
        •
      </span>

      <span className={`sync-phase phase-${phase}`}>{phaseLabel}</span>

      <span className="sync-meta">
        Last synced: {formatTime(lastSyncedAt)}
      </span>

      {phase === "error" && error && (
        <span className="sync-error" title={error}>
          {error}
        </span>
      )}

      {lastResult?.status === "skipped" &&
        lastResult.reason === "no-endpoint" && (
          <span className="sync-meta sync-hint">
            (no sync endpoint configured)
          </span>
        )}

      <button
        type="button"
        className="sync-btn"
        onClick={() => void syncNow()}
        disabled={phase === "syncing"}
      >
        Sync now
      </button>

      <button
        type="button"
        className="sync-btn sync-btn-secondary"
        onClick={() => void pushAll(syncNow)}
        disabled={phase === "syncing"}
        title="Mark all local records dirty and push them to DynamoDB"
      >
        Push all to cloud
      </button>
    </div>
  );
}

export default SyncIndicator;
