/**
 * TALAS — voice recording storage (S3 via presigned URLs).
 *
 * Audio recordings are too large for DynamoDB, so they live in an S3 bucket.
 * The browser never holds AWS credentials: it asks the `talasFunction` Lambda
 * (the same endpoint as sync) for a short-lived presigned URL, then uploads the
 * audio Blob directly to S3. The reading attempt record only stores the S3
 * object key, which syncs to DynamoDB like any other field.
 *
 * Flow:
 *   uploadRecording(blob, learnerId, attemptId)
 *     1. POST { action: "presign-upload", key, contentType } -> { url }
 *     2. PUT the blob to that url (browser -> S3 directly)
 *     3. return the S3 key to store on the attempt
 *
 *   getRecordingUrl(key)
 *     POST { action: "presign-download", key } -> { url } for playback
 */

const SYNC_URL: string = import.meta.env.VITE_TALAS_SYNC_URL ?? "";

export function isRecordingStorageConfigured(): boolean {
  return SYNC_URL.trim().length > 0;
}

/** Picks a file extension from the blob's MIME type. */
function extensionFor(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  return "webm";
}

/** Builds a stable, namespaced S3 key for a learner's recording. */
export function buildRecordingKey(
  learnerId: string,
  attemptId: string,
  blob: Blob,
): string {
  return `recordings/${learnerId}/${attemptId}.${extensionFor(blob)}`;
}

async function requestPresign(payload: Record<string, unknown>): Promise<string> {
  const res = await fetch(SYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Presign request failed: HTTP ${res.status}`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Presign response missing url");
  return data.url;
}

/**
 * Uploads a recording Blob to S3 and returns the stored object key.
 * Throws if storage isn't configured or the upload fails — callers should
 * treat upload as best-effort (the attempt still saves locally without it).
 */
export async function uploadRecording(
  blob: Blob,
  learnerId: string,
  attemptId: string,
): Promise<string> {
  if (!isRecordingStorageConfigured()) {
    throw new Error("Recording storage endpoint not configured.");
  }
  const key = buildRecordingKey(learnerId, attemptId, blob);
  const contentType = blob.type || "audio/webm";

  // 1) Get a presigned PUT url from the Lambda.
  const uploadUrl = await requestPresign({
    action: "presign-upload",
    key,
    contentType,
  });

  // 2) Upload the audio bytes straight to S3.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) throw new Error(`S3 upload failed: HTTP ${put.status}`);

  return key;
}

/**
 * Returns a short-lived, playable HTTPS URL for a stored recording key.
 * Used by the teacher review (and learner result) to play back the audio.
 */
export async function getRecordingUrl(key: string): Promise<string> {
  if (!isRecordingStorageConfigured()) {
    throw new Error("Recording storage endpoint not configured.");
  }
  return requestPresign({ action: "presign-download", key });
}
