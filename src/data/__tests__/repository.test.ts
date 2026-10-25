import { describe, it, expect } from "vitest";
import { save, softDelete, list, getById } from "../repository";
import { get } from "../db";
import { STORES } from "../types";
import type { Learner } from "../types";

const baseLearner = (id: string): Learner => ({
  id,
  name: `Learner ${id}`,
  createdAt: "2026-10-03T09:00:00.000Z",
});

describe("repository write path", () => {
  it("save() stamps updatedAt and marks the record dirty", async () => {
    const saved = await save(STORES.learners, baseLearner("l1"));
    expect(saved.dirty).toBe(true);
    expect(typeof saved.updatedAt).toBe("string");

    const stored = await get(STORES.learners, "l1");
    expect(stored?.dirty).toBe(true);
  });

  it("softDelete() tombstones and marks dirty, hiding from reads", async () => {
    await save(STORES.learners, baseLearner("l2"));

    const ok = await softDelete(STORES.learners, "l2");
    expect(ok).toBe(true);

    // Still present in the raw store (as a tombstone)...
    const raw = await get(STORES.learners, "l2");
    expect(raw?.deleted).toBe(true);
    expect(raw?.dirty).toBe(true);

    // ...but hidden from repository reads.
    expect(await getById(STORES.learners, "l2")).toBeUndefined();
    const live = await list(STORES.learners);
    expect(live.find((l) => l.id === "l2")).toBeUndefined();
  });

  it("softDelete() returns false for a missing id", async () => {
    expect(await softDelete(STORES.learners, "missing")).toBe(false);
  });
});
