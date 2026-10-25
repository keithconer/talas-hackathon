/**
 * TALAS — sync endpoint smoke test.
 *
 * Exercises the `POST /sync` contract against a live Function URL. Verifies a
 * push round-trips: send a record, then pull it back with since=null.
 *
 * Usage:
 *   node test-sync.mjs https://<id>.lambda-url.ap-southeast-2.on.aws/
 * or set TALAS_SYNC_URL in the environment.
 */

const url = process.argv[2] ?? process.env.TALAS_SYNC_URL;

if (!url) {
  console.error(
    "Provide the Function URL: node test-sync.mjs https://....lambda-url.ap-southeast-2.on.aws/",
  );
  process.exit(1);
}

async function postSync(payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const nowIso = new Date().toISOString();
const testId = `test-${Date.now()}`;

try {
  console.log("1) Empty sync (handshake)...");
  const empty = await postSync({ since: null, changes: [] });
  console.log("   serverTime:", empty.serverTime);
  if (!empty.serverTime) throw new Error("missing serverTime in response");

  console.log("2) Push a learner record...");
  await postSync({
    since: null,
    changes: [
      {
        store: "learners",
        op: "put",
        record: {
          id: testId,
          name: "Smoke Test",
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
    ],
  });

  console.log("3) Pull it back (since=null)...");
  const pulled = await postSync({ since: null, changes: [] });
  const found = pulled.changes.find((c) => c.record?.id === testId);
  if (!found) throw new Error("pushed record did not come back on pull");

  console.log("   found:", JSON.stringify(found.record));
  console.log("\n✅ Sync contract OK — push + pull round-trip works.");
} catch (err) {
  console.error("\n❌ Sync contract FAILED:", err.message);
  process.exit(1);
}
