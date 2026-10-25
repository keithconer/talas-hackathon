/**
 * TALAS — talasFunction sync & AI handler (AWS Lambda, Node.js 20+, AWS SDK v3).
 *
 * Implements:
 *   1. `POST /sync` contract used by the web client (offline/online LWW sync).
 *   2. S3 presigned URLs (`action: "presign-upload" | "presign-download"`).
 *   3. Server-side Gemini intervention generation (`action: "gemini-intervention"`),
 *      keeping `GEMINI_API_KEY` strictly on the server. Works out-of-the-box in the
 *      AWS Lambda inline code editor (Node.js 20 built-in `fetch`) without requiring
 *      external npm layers.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const TABLE_NAME = process.env.TALAS_TABLE ?? "talas";
const REGION = process.env.AWS_REGION ?? "ap-southeast-2";
const RECORDINGS_BUCKET = process.env.RECORDINGS_BUCKET ?? "talas-recordings";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});

const s3 = new S3Client({ region: REGION });

/** How long presigned URLs stay valid (seconds). */
const PRESIGN_EXPIRY = 900; // 15 minutes

async function presign(mode, key, contentType) {
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Missing S3 key");
  }
  const command =
    mode === "upload"
      ? new PutObjectCommand({
          Bucket: RECORDINGS_BUCKET,
          Key: key,
          ContentType: contentType || "audio/webm",
        })
      : new GetObjectCommand({ Bucket: RECORDINGS_BUCKET, Key: key });

  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY });
}

/** Server-side, context-aware Tagalog transcription of a submitted reading. */
async function transcribeRecording(key, passage) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Lambda environment variables.");
  if (typeof key !== "string" || !/^recordings\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(key)) {
    throw new Error("Invalid recording key.");
  }
  if (typeof passage !== "string" || passage.trim().length === 0 || passage.length > 12000) {
    throw new Error("Missing or invalid reading passage.");
  }

  const stored = await s3.send(new GetObjectCommand({ Bucket: RECORDINGS_BUCKET, Key: key }));
  if (stored.ContentLength > 25 * 1024 * 1024) throw new Error("The recording exceeds the transcription size limit.");
  const bytes = await stored.Body?.transformToByteArray();
  if (!bytes?.byteLength) throw new Error("The recording is empty or unavailable.");
  if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("The recording exceeds the transcription size limit.");

  const form = new FormData();
  const contentType = stored.ContentType || "audio/webm";
  const extension = contentType.includes("mp4") ? "m4a" : contentType.includes("ogg") ? "ogg" : "webm";
  form.append("file", new Blob([bytes], { type: contentType }), `reading.${extension}`);
  form.append("model", "gpt-transcribe");
  form.append("prompt", `Filipino/Tagalog child reading aloud. Transcribe only words actually spoken; do not fill in omitted words. Use this passage only to resolve the spelling of words: ${passage.slice(0, 8000)}`);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("[talasFunction] OpenAI transcription error:", response.status, result?.error?.message ?? "");
    throw new Error(`OpenAI transcription failed (HTTP ${response.status}).`);
  }
  if (typeof result?.text !== "string" || !result.text.trim()) {
    throw new Error("OpenAI returned an empty transcription.");
  }
  return result.text.trim();
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

function reply(statusCode, bodyObj) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(bodyObj) };
}

function ts(iso) {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(n) ? 0 : n;
}

async function getStored(id) {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { userId: id } }),
  );
  return res.Item;
}

async function applyChange(change) {
  const { store, op, record } = change;
  if (!record || typeof record.id !== "string") return false;

  const stored = await getStored(record.id);
  const incomingTime = ts(record.updatedAt);

  if (stored && ts(stored.updatedAt) >= incomingTime) return false;

  const item = {
    userId: record.id,
    store,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
    deleted: op === "delete" ? true : record.deleted === true,
    data: record,
  };

  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
  return true;
}

async function pullSince(since) {
  const sinceTime = ts(since);
  const changes = [];
  let ExclusiveStartKey;

  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: TABLE_NAME, ExclusiveStartKey }),
    );
    for (const item of res.Items ?? []) {
      if (ts(item.updatedAt) <= sinceTime) continue;
      const record = item.data ?? { id: item.userId, updatedAt: item.updatedAt };
      changes.push({
        store: item.store,
        op: item.deleted === true ? "delete" : "put",
        record,
      });
    }
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return changes;
}

/**
 * Extracts the assistant text from a Gemini Interactions API response object.
 */
function extractInteractionText(interaction) {
  if (typeof interaction?.output_text === "string" && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }
  const steps = Array.isArray(interaction?.steps) ? interaction.steps : [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (typeof step?.content === "string" && step.content.trim()) {
      return step.content.trim();
    }
    if (Array.isArray(step?.content)) {
      const joined = step.content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();
      if (joined) return joined;
    }
  }
  return "";
}

/**
 * Runs a Gemini interaction on the server using `process.env.GEMINI_API_KEY`.
 * Automatically falls back across Gemini 3.x Flash models if `gemini-3.8-flash`
 * returns 503 (high demand).
 */
async function runGeminiIntervention(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in Lambda environment variables.");
  }
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new Error("Missing intervention prompt.");
  }

  const interactionsUrl = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${encodeURIComponent(
    apiKey,
  )}`;

  const modelsToTry = [
    "models/gemini-3.5-flash-lite",
    "models/gemini-3.5-flash",
    "models/gemini-3.8-flash",
  ];

  let lastError = "Gemini API request failed.";

  for (const modelName of modelsToTry) {
    const intRes = await fetch(interactionsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        input: prompt,
        generation_config: {
          max_output_tokens: 8192,
        },
      }),
    });

    if (intRes.ok) {
      const intData = await intRes.json();
      const intText = extractInteractionText(intData);
      if (intText) {
        return {
          model: modelName,
          outputText: intText,
        };
      }
    } else {
      const errText = await intRes.text().catch(() => "");
      lastError = `HTTP ${intRes.status} (${modelName}): ${errText.slice(0, 200)}`;
    }
  }

  throw new Error(lastError);
}

export const handler = async (event) => {
  const method =
    event?.requestContext?.http?.method ?? event?.httpMethod ?? "POST";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: JSON_HEADERS, body: "" };
  }
  if (method !== "POST") {
    return reply(405, { error: "Method not allowed. Use POST." });
  }

  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return reply(400, { error: "Invalid JSON body." });
  }

  // ── Recording presign routes (S3) ──
  if (body?.action === "presign-upload" || body?.action === "presign-download") {
    try {
      const mode = body.action === "presign-upload" ? "upload" : "download";
      const url = await presign(mode, body.key, body.contentType);
      return reply(200, { url, key: body.key, expiresIn: PRESIGN_EXPIRY });
    } catch (err) {
      console.error("[talasFunction] presign error:", err);
      return reply(400, { error: err.message ?? "Presign failed." });
    }
  }

  // ── Optional context-aware speech transcription ──
  if (body?.action === "transcribe-recording") {
    try {
      const transcript = await transcribeRecording(body.key, body.passage);
      return reply(200, { transcript, model: "gpt-transcribe" });
    } catch (err) {
      console.error("[talasFunction] transcription error:", err);
      return reply(502, { error: err.message ?? "Transcription failed." });
    }
  }

  // ── Server-side Gemini Intervention route ──
  if (body?.action === "gemini-intervention") {
    try {
      const result = await runGeminiIntervention(body.prompt);
      return reply(200, result);
    } catch (err) {
      console.error("[talasFunction] gemini-intervention error:", err);
      return reply(502, {
        error: err.message ?? "Gemini intervention generation failed.",
      });
    }
  }

  // ── Offline/Online LWW Sync route ──
  const since = typeof body?.since === "string" ? body.since : null;
  const incoming = Array.isArray(body?.changes) ? body.changes : [];

  try {
    for (const change of incoming) {
      await applyChange(change);
    }
    const changes = await pullSince(since);
    return reply(200, {
      serverTime: new Date().toISOString(),
      changes,
    });
  } catch (err) {
    console.error("[talasFunction] sync error:", err);
    return reply(500, { error: "Sync failed.", detail: err.message });
  }
};
