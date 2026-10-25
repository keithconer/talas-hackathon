/**
 * TALAS — DataViewer.
 *
 * A simple read-only dashboard that shows everything currently in the local
 * IndexedDB: teachers, learners, assessments, and assignments. Reads through
 * the repository so soft-deleted (tombstoned) records are hidden.
 *
 * Refreshes on mount, after a sync completes, and via a manual button.
 */

import { useCallback, useEffect, useState } from "react";
import {
  list,
  STORES,
  onSyncStatus,
  type Assessment,
  type Assignment,
  type Learner,
  type Teacher,
} from "../data";
import "./DataViewer.css";

interface AllData {
  teachers: Teacher[];
  learners: Learner[];
  assessments: Assessment[];
  assignments: Assignment[];
}

const EMPTY: AllData = {
  teachers: [],
  learners: [],
  assessments: [],
  assignments: [],
};

export function DataViewer() {
  const [data, setData] = useState<AllData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachers, learners, assessments, assignments] = await Promise.all([
        list(STORES.teachers),
        list(STORES.learners),
        list(STORES.assessments),
        list(STORES.assignments),
      ]);
      setData({ teachers, learners, assessments, assignments });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load asynchronously (not synchronously in the effect body) so we don't
    // trigger a cascading render, then re-load after each completed sync.
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    const unsubscribe = onSyncStatus((s) => {
      if (s.phase === "idle") void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [load]);

  const total =
    data.teachers.length +
    data.learners.length +
    data.assessments.length +
    data.assignments.length;

  return (
    <div className="data-viewer">
      <header className="dv-header">
        <h1>TALAS — Local Database</h1>
        <div className="dv-actions">
          <span className="dv-count">{total} records</span>
          <button
            type="button"
            className="dv-refresh"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {error && <p className="dv-error">Error: {error}</p>}

      <section className="dv-section">
        <h2>Teachers <span>({data.teachers.length})</span></h2>
        <Table
          columns={["id", "name", "email", "updatedAt"]}
          rows={data.teachers}
          empty="No teachers."
        />
      </section>

      <section className="dv-section">
        <h2>Learners <span>({data.learners.length})</span></h2>
        <Table
          columns={["id", "name", "displayName", "grade", "updatedAt"]}
          rows={data.learners}
          empty="No learners."
        />
      </section>

      <section className="dv-section">
        <h2>Assessments <span>({data.assessments.length})</span></h2>
        <Table
          columns={["id", "title", "subject", "questions", "updatedAt"]}
          rows={data.assessments.map((a) => ({
            ...a,
            questions: a.questions?.length ?? 0,
          }))}
          empty="No assessments."
        />
      </section>

      <section className="dv-section">
        <h2>Assignments <span>({data.assignments.length})</span></h2>
        <Table
          columns={[
            "id",
            "assessmentId",
            "learnerId",
            "status",
            "dueAt",
            "updatedAt",
          ]}
          rows={data.assignments}
          empty="No assignments."
        />
      </section>
    </div>
  );
}

/** Minimal, generic table that renders the given columns of each row. */
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

export default DataViewer;
