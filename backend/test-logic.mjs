/**
 * Local logic test for the sync handler — no AWS needed.
 *
 * Stubs @aws-sdk/lib-dynamodb's DocumentClient with an in-memory store, then
 * drives handler() to verify: push + LWW, since-based pull, delete tombstones,
 * and the response shape. Run with: node test-logic.mjs
 */

import assert from "node:assert/strict";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand }
  from "@aws-sdk/lib-dynamodb";

// --- In-memory stub of the DocumentClient ---------------------------------
const store = new Map(); // userId -> item

DynamoDBDocumentClient.from = () => ({
  async send(cmd) {
    if (cmd instanceof GetCommand) {
      return { Item: store.get(cmd.input.Key.userId) };
    }
    if (cmd instanceof PutCommand) {
      store.set(cmd.input.Item.userId, cmd.input.Item);
      return {};
    }
    if (cmd instanceof ScanCommand) {
      return { Items: [...store.values()], LastEvaluatedKey: undefined };
    }
    throw new Error("Unexpected command: " + cmd.constructor.name);
  },
});

// Import the handler AFTER stubbing so it picks up the stub.
const { handler } = await import("./index.mjs");

function invoke(body) {
  return handler({
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(body),
  });
}

function parse(res) {
  assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}`);
  return JSON.parse(res.body);
}

const t1 = "2026-10-03T09:00:00.000Z";
const t2 = "2026-10-03T10:00:00.000Z";
const t3 = "2026-10-03T11:00:00.000Z";

// 1) Handshake returns a serverTime.
{
  const out = parse(await invoke({ since: null, changes: [] }));
  assert.ok(out.serverTime, "serverTime present");
  assert.deepEqual(out.changes, []);
}

// 2) Push a record, then it appears when pulling with since=null.
{
  await invoke({
    since: null,
    changes: [
      { store: "learners", op: "put",
        record: { id: "l1", name: "Maria", createdAt: t1, updatedAt: t2 } },
    ],
  });
  const out = parse(await invoke({ since: null, changes: [] }));
  const rec = out.changes.find((c) => c.record.id === "l1");
  assert.ok(rec, "pushed record pulled back");
  assert.equal(rec.record.name, "Maria");
}

// 3) LWW: an OLDER incoming update is rejected.
{
  await invoke({
    since: null,
    changes: [
      { store: "learners", op: "put",
        record: { id: "l1", name: "STALE", createdAt: t1, updatedAt: t1 } },
    ],
  });
  assert.equal(store.get("l1").data.name, "Maria", "older write rejected (LWW)");
}

// 4) LWW: a NEWER incoming update wins.
{
  await invoke({
    since: null,
    changes: [
      { store: "learners", op: "put",
        record: { id: "l1", name: "Maria-2", createdAt: t1, updatedAt: t3 } },
    ],
  });
  assert.equal(store.get("l1").data.name, "Maria-2", "newer write wins (LWW)");
}

// 5) since filter: nothing newer than t3 should come back.
{
  const out = parse(await invoke({ since: t3, changes: [] }));
  assert.equal(out.changes.length, 0, "since filter excludes <= since");
}

// 6) delete op produces a tombstone that pulls back as op:delete.
{
  await invoke({
    since: null,
    changes: [
      { store: "learners", op: "delete",
        record: { id: "l1", updatedAt: "2026-10-03T12:00:00.000Z" } },
    ],
  });
  const out = parse(await invoke({ since: null, changes: [] }));
  const rec = out.changes.find((c) => c.record.id === "l1");
  assert.equal(rec.op, "delete", "tombstone pulls back as delete");
}

console.log("✅ handler logic OK — 6 checks passed");
