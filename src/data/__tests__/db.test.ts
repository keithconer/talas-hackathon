import { describe, it, expect } from "vitest";
import { openDB, getAll, count, getSyncState, setSyncState } from "../db";
import { STORES, SYNC_STATE_STORE } from "../types";
import { seedDatabase, LEARNER_MARIA, LEARNER_AMINA } from "../seed";

describe("db schema (v2)", () => {
  it("creates all entity stores plus syncState", async () => {
    const db = await openDB();
    const names = Array.from(db.objectStoreNames);
    expect(names).toContain(STORES.learners);
    expect(names).toContain(STORES.teachers);
    expect(names).toContain(STORES.assessments);
    expect(names).toContain(STORES.assignments);
    expect(names).toContain(SYNC_STATE_STORE);
  });

  it("round-trips syncState key-values", async () => {
    expect(await getSyncState("lastPulledAt")).toBeUndefined();
    await setSyncState("lastPulledAt", "2026-10-03T09:00:00.000Z");
    expect(await getSyncState("lastPulledAt")).toBe(
      "2026-10-03T09:00:00.000Z",
    );
  });
});

describe("seedDatabase", () => {
  it("seeds Maria, Amina, a teacher, an assessment, and an assignment", async () => {
    const seeded = await seedDatabase();
    expect(seeded).toBe(true);

    const learners = await getAll(STORES.learners);
    const ids = learners.map((l) => l.id).sort();
    expect(ids).toEqual([LEARNER_AMINA.id, LEARNER_MARIA.id].sort());

    expect(await count(STORES.teachers)).toBe(1);
    expect(await count(STORES.assessments)).toBe(1);
    expect(await count(STORES.assignments)).toBe(1);
  });

  it("stamps updatedAt on seeded records", async () => {
    await seedDatabase();
    const learners = await getAll(STORES.learners);
    for (const l of learners) {
      expect(typeof l.updatedAt).toBe("string");
    }
  });

  it("is idempotent (second call is a no-op)", async () => {
    expect(await seedDatabase()).toBe(true);
    expect(await seedDatabase()).toBe(false);
    expect(await count(STORES.learners)).toBe(2);
  });
});
