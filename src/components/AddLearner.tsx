/**
 * TALAS — AddLearner form.
 *
 * Creates a new learner through the repository's sync-aware write path:
 * `save()` stamps updatedAt + marks it dirty, so the next sync pushes it to
 * DynamoDB. After saving, it triggers a sync and nudges the viewers to refresh.
 */

import { useState } from "react";
import { save, STORES, syncNow, useOnline, type Learner } from "../data";
import "./AddLearner.css";

/** Generates a URL-safe id from a name plus a short random suffix. */
function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 7);
  return `learner-${slug || "new"}-${suffix}`;
}

export function AddLearner() {
  const online = useOnline();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setMessage(null);
    try {
      const learner: Learner = {
        id: makeId(trimmed),
        name: trimmed,
        displayName: trimmed,
        grade: grade.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      // 1) Save locally (marks dirty). This alone makes it show in the UI.
      await save(STORES.learners, learner);

      // 2) Try to push to the cloud. Offline is fine — it stays dirty and
      //    syncs later. We don't fail the create if sync can't run.
      const result = await syncNow();

      setMessage(
        result.status === "ok"
          ? `Added "${trimmed}" and synced to cloud.`
          : `Added "${trimmed}" locally. Will sync when online.`,
      );
      setName("");
      setGrade("");
    } catch (err) {
      setMessage(
        `Failed to add learner: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="add-learner" onSubmit={onSubmit}>
      <h2>Add a learner</h2>
      <div className="al-row">
        <input
          id="al-name"
          name="name"
          className="al-input"
          type="text"
          placeholder="Name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={busy}
          aria-label="Learner name"
        />
        <input
          id="al-grade"
          name="grade"
          className="al-input"
          type="text"
          placeholder="Grade (optional)"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          disabled={busy}
          aria-label="Grade"
        />
        <button
          className="al-btn"
          type="submit"
          disabled={busy || name.trim() === ""}
        >
          {busy ? "Saving…" : "Add"}
        </button>
      </div>
      <p className="al-status">
        {message ?? (online ? "" : "You are offline — new data saves locally and syncs later.")}
      </p>
    </form>
  );
}

export default AddLearner;
