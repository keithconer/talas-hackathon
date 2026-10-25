/**
 * TALAS — CloudViewer.
 *
 * Read-only view of what is actually stored in the backend (DynamoDB `talas`
 * table). Unlike DataViewer (which reads local IndexedDB), this pulls straight
 * from the sync endpoint so you can see the cloud contents and compare.
 *
 * Refreshes on mount, after a sync completes, and via a manual button.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchAllFromCloud,
  isSyncConfigured,
  onSyncStatus,
  type SyncChange,
} from "../data";
import "./DataViewer.css";

type Grouped = Record<string, SyncChange["record"][]>;

const STORE_ORDER = ["teachers", "learners", "assessments", "assignments"];

export function CloudViewer() {
  const [grouped, setGrouped] = useState<Grouped>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSyncConfigured();

  const load = useCallback(async () => {
    if (!isSyncConfigured()) {
      setError("No sync endpoint configured (VITE_TALAS_SYNC_URL).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAllFromCloud();
      const next: Grouped = {};
      for (const change of res.changes) {
        // Skip tombstones so the view matches "live" records.
        if (change.op === "delete") continue;
        (next[change.store] ??= []).push(change.record);
      }
      setGrouped(next);
      setTotal(res.changes.filter((c) => c.op !== "delete").length);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    // Refresh after each completed sync so the cloud view stays current.
    const unsubscribe = onSyncStatus((s) => {
      if (s.phase === "idle") void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [load]);

  return (
    <div className="data-viewer">
      <header className="dv-header">
        <h1>TALAS — Cloud (DynamoDB)</h1>
        <div className="dv-actions">
          <span className="dv-count">{total} records</span>
          <button
            type="button"
            className="dv-refresh"
            onClick={() => void load()}
            disabled={loading || !configured}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {!configured && (
        <p className="dv-empty">
          No sync endpoint configured. Set VITE_TALAS_SYNC_URL in .env to view
          cloud data.
        </p>
      )}

      {error && <p className="dv-error">Error: {error}</p>}

      {configured &&
        STORE_ORDER.map((store) => {
          const rows = grouped[store] ?? [];
          const columns = columnsFor(store);
          return (
            <section className="dv-section" key={store}>
              <h2>
                {capitalize(store)} <span>({rows.length})</span>
              </h2>
              <Table
                columns={columns}
                rows={rows.map((r) => shapeRow(store, r))}
                empty={`No ${store} in cloud.`}
              />
            </section>
          );
        })}
    </div>
  );
}

function columnsFor(store: string): string[] {
  switch (store) {
    case "teachers":
      return ["id", "name", "email", "updatedAt"];
    case "learners":
      return ["id", "name", "displayName", "grade", "updatedAt"];
    case "assessments":
      return ["id", "title", "subject", "questions", "updatedAt"];
    case "assignments":
      return ["id", "assessmentId", "learnerId", "status", "dueAt", "updatedAt"];
    default:
      return ["id", "updatedAt"];
  }
}

/** Normalizes a record for display (e.g. questions -> count). */
function shapeRow(store: string, record: object): object {
  const r = record as Record<string, unknown>;
  if (store === "assessments" && Array.isArray(r.questions)) {
    return { ...r, questions: r.questions.length };
  }
  return record;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Minimal, generic table (same look as DataViewer). */
function Table({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: readonly object[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="dv-empty">{empty}</p>;
  }
  return (
    <div className="dv-table-wrap">
      <table className="dv-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const record = row as Record<string, unknown>;
            return (
              <tr key={String(record.id ?? i)}>
                {columns.map((c) => (
                  <td key={c}>{formatCell(record[c])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

export default CloudViewer;
