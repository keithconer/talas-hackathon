import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SyncRequest, SyncResponse } from "../types";

// Mock the HTTPS client so the sync engine runs without a network. The factory
// must not reference outer variables (hoisting), so we grab the mock after.
vi.mock("../api", () => {
  return {
    isSyncConfigured: () => true,
    SyncError: class SyncError extends Error {},
    postSync: vi.fn(),
  };
});

import { postSync } from "../api";
import { sync } from "../sync";
import { save } from "../repository";
import { get, put, getSyncState } from "../db";
import { STORES, SYNC_KEYS } from "../types";
import type { Learner } from "../types";

const mockedPostSync = vi.mocked(postSync);

const learner = (id: string, updatedAt: string): Learner => ({
  id,
  name: `L-${id}`,
  createdAt: "2026-10-03T09:00:00.000Z",
  updatedAt,
});

beforeEach(() => {
  mockedPostSync.mockReset();
});

describe("sync engine", () => {
  it("pushes dirty records and clears their dirty flag on success", async () => {
    await save(STORES.learners, learner("l1", "2026-10-03T09:00:00.000Z"));

    let sent: SyncRequest | undefined;
    mockedPostSync.mockImplementation(async (req: SyncRequest) => {
      sent = req;
      const res: SyncResponse = {
        serverTime: "2026-10-03T10:00:00.000Z",
        changes: [],
      };
      return res;
    });

    const result = await sync();

    expect(result.status).toBe("ok");
    expect(result.pushed).toBe(1);
    expect(sent?.changes).toHaveLength(1);
    expect(sent?.changes[0].op).toBe("put");

    const stored = await get(STORES.learners, "l1");
    expect(stored?.dirty).toBe(false);
    expect(stored?.syncedAt).toBeTypeOf("string");

    // Pull cursor advanced to the server clock.
    expect(await getSyncState(SYNC_KEYS.lastPulledAt)).toBe(
      "2026-10-03T10:00:00.000Z",
    );
  });

  it("applies incoming server records using last-write-wins", async () => {
    // Local copy is OLD; server copy is NEWER -> server wins.
    await put(STORES.learners, {
      ...learner("l1", "2026-10-03T09:00:00.000Z"),
      name: "old-name",
      dirty: false,
    });

    mockedPostSync.mockResolvedValue({
      serverTime: "2026-10-03T11:00:00.000Z",
      changes: [
        {
          store: STORES.learners,
          op: "put",
          record: { ...learner("l1", "2026-10-03T10:30:00.000Z"), name: "new-name" },
        },
      ],
    });

    const result = await sync();
    expect(result.pulled).toBe(1);

    const stored = await get(STORES.learners, "l1");
    expect(stored?.name).toBe("new-name");
    expect(stored?.dirty).toBe(false);
  });

  it("keeps the local record when it is newer than the incoming one (LWW)", async () => {
    await put(STORES.learners, {
      ...learner("l1", "2026-10-03T12:00:00.000Z"),
      name: "local-newer",
      dirty: false,
    });

    mockedPostSync.mockResolvedValue({
      serverTime: "2026-10-03T13:00:00.000Z",
      changes: [
        {
          store: STORES.learners,
          op: "put",
          record: { ...learner("l1", "2026-10-03T10:00:00.000Z"), name: "server-older" },
        },
      ],
    });

    const result = await sync();
    expect(result.pulled).toBe(0);

    const stored = await get(STORES.learners, "l1");
    expect(stored?.name).toBe("local-newer");
  });

  it("propagates incoming deletes as tombstones", async () => {
    await put(STORES.learners, {
      ...learner("l1", "2026-10-03T09:00:00.000Z"),
      dirty: false,
    });

    mockedPostSync.mockResolvedValue({
      serverTime: "2026-10-03T11:00:00.000Z",
      changes: [
        {
          store: STORES.learners,
          op: "delete",
          record: learner("l1", "2026-10-03T10:00:00.000Z"),
        },
      ],
    });

    await sync();

    const stored = await get(STORES.learners, "l1");
    expect(stored?.deleted).toBe(true);
  });

  it("leaves records dirty when the push fails", async () => {
    await save(STORES.learners, learner("l1", "2026-10-03T09:00:00.000Z"));
    mockedPostSync.mockRejectedValue(new Error("network down"));

    const result = await sync();
    expect(result.status).toBe("error");

    const stored = await get(STORES.learners, "l1");
    expect(stored?.dirty).toBe(true); // preserved for the next attempt
  });

  it("is a no-op on a second run when nothing changed", async () => {
    await save(STORES.learners, learner("l1", "2026-10-03T09:00:00.000Z"));
    mockedPostSync.mockResolvedValue({
      serverTime: "2026-10-03T10:00:00.000Z",
      changes: [],
    });

    const first = await sync();
    expect(first.pushed).toBe(1);

    const second = await sync();
    expect(second.pushed).toBe(0);
  });
});
