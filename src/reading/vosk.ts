/**
 * TALAS — offline speech recognition via Vosk (WebAssembly).
 *
 * Unlike the browser Web Speech API (which streams audio to a vendor server and
 * therefore needs a connection), Vosk runs a speech model entirely on-device in
 * a WebWorker. Once the model file is downloaded and cached by the PWA service
 * worker, recognition works with no network at all.
 *
 * The model is a `.tar.gz` placed under `public/models/` and referenced by URL.
 * We keep the model path configurable and lazily loaded so the app still builds
 * and runs when no model has been bundled yet (recognition simply reports as
 * unavailable, and the UI falls back to recording + manual transcript).
 *
 * Audio pipeline: getUserMedia (16 kHz mono) -> AudioContext ScriptProcessor ->
 * recognizer.acceptWaveform. ScriptProcessorNode is deprecated but is what
 * vosk-browser's examples use and has the widest support for this purpose.
 */

import type { Model, KaldiRecognizer } from "vosk-browser";

/** Default location of the Filipino model inside the PWA's public assets. */
export const DEFAULT_MODEL_URL = "/models/vosk-model-tl.tar.gz";

/**
 * Lazily imports vosk-browser so its multi-MB WebAssembly bundle is code-split
 * into its own chunk and only downloaded when a learner actually starts an
 * offline reading — keeping the initial app shell small.
 */
async function getCreateModel() {
  const mod = await import("vosk-browser");
  return mod.createModel;
}

export interface VoskSession {
  /** Stops recognition, releases the mic + audio graph. Returns final text. */
  stop: () => Promise<string>;
  /** Current best transcript (final + in-progress partial). */
  getTranscript: () => string;
}

/** One recognized word with its real audio offsets (seconds), from Vosk. */
export interface VoskWord {
  word: string;
  start: number;
  end: number;
}

export interface VoskCallbacks {
  onPartial?: (text: string) => void;
  onResult?: (fullText: string) => void;
  /** Accumulated per-word timings so far (accurate, from the recognizer). */
  onWords?: (words: VoskWord[]) => void;
  onError?: (message: string) => void;
}

/** Module-level cache so we only download/parse the model once per session. */
let modelPromise: Promise<Model> | null = null;
let modelUrlLoaded: string | null = null;

/**
 * Returns true if a model file appears to be present at `url`. Uses a HEAD
 * request so we don't download the (large) model just to check. When offline
 * but the model was already cached by the service worker, the HEAD still
 * succeeds from cache.
 */
export async function isModelAvailable(
  url = DEFAULT_MODEL_URL,
): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return false;

    // Dev servers and the PWA fall back to serving index.html for unknown
    // paths — a 200 does NOT mean the model exists. Reject anything that looks
    // like an HTML page or is too small to be a real model archive.
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (type.includes("text/html")) return false;

    const len = Number(res.headers.get("content-length") ?? "0");
    // A real Vosk model archive is many MB; anything under ~1MB is the HTML
    // fallback or a stub. If the length header is missing (len === 0) we can't
    // trust it, so treat it as unavailable to avoid hanging on a bad load.
    if (len > 0 && len < 1_000_000) return false;
    if (len === 0) return false;

    return true;
  } catch {
    return false;
  }
}

/** How long to wait for the model to load before giving up (ms). */
const MODEL_LOAD_TIMEOUT_MS = 30_000;

/** Loads (and caches) the Vosk model. Safe to call repeatedly. */
export async function loadModel(url = DEFAULT_MODEL_URL): Promise<Model> {
  if (modelPromise && modelUrlLoaded === url) return modelPromise;
  modelUrlLoaded = url;

  // Race the load against a timeout so a bad/missing archive can't hang the UI
  // forever — the hook then falls through to the next recognition engine.
  const load = getCreateModel().then((createModel) => createModel(url));
  const guarded = new Promise<Model>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Vosk model load timed out")),
      MODEL_LOAD_TIMEOUT_MS,
    );
    load.then(
      (model) => {
        clearTimeout(timer);
        resolve(model);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

  modelPromise = guarded;
  try {
    return await modelPromise;
  } catch (err) {
    // Reset so a later retry can attempt the load again.
    modelPromise = null;
    modelUrlLoaded = null;
    throw err;
  }
}

/**
 * Starts an offline recognition session. Resolves once the model is loaded and
 * the mic is streaming. Caller provides a MediaStream (so audio recording and
 * recognition can share one mic grant), or we request our own.
 */
export async function startVosk(
  stream: MediaStream,
  callbacks: VoskCallbacks = {},
  modelUrl = DEFAULT_MODEL_URL,
): Promise<VoskSession> {
  const model = await loadModel(modelUrl);

  // Vosk models in this build expect 16 kHz. The recognizer resamples via the
  // sampleRate we pass, but we also hint the AudioContext toward 16 kHz.
  const SAMPLE_RATE = 16000;
  const recognizer: KaldiRecognizer = new model.KaldiRecognizer(SAMPLE_RATE);
  recognizer.setWords(true);

  let finalText = "";
  let partialText = "";
  const allWords: VoskWord[] = [];

  recognizer.on("result", (message) => {
    const res =
      "result" in message && message.result
        ? (message.result as {
            text?: string;
            result?: Array<{ word: string; start: number; end: number }>;
          })
        : {};
    const text = res.text ?? "";
    if (text) {
      finalText = (finalText + " " + text).trim();
      partialText = "";
      callbacks.onResult?.(finalText);
    }
    // Vosk returns real per-word audio offsets — far more accurate than any
    // estimate. Accumulate them and report up.
    if (Array.isArray(res.result) && res.result.length > 0) {
      for (const w of res.result) {
        allWords.push({ word: w.word, start: w.start, end: w.end });
      }
      callbacks.onWords?.(allWords.slice());
    }
  });

  recognizer.on("partialresult", (message) => {
    const partial =
      "result" in message && message.result
        ? (message.result as { partial?: string }).partial ?? ""
        : "";
    partialText = partial;
    callbacks.onPartial?.((finalText + " " + partialText).trim());
  });

  recognizer.on("error", (message) => {
    const msg =
      "error" in message && typeof message.error === "string"
        ? message.error
        : "Vosk recognizer error";
    callbacks.onError?.(msg);
  });

  // Build the audio graph.
  type WebkitAudioWindow = typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctx =
    window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
  const audioContext = new Ctx({ sampleRate: SAMPLE_RATE });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    try {
      recognizer.acceptWaveform(event.inputBuffer);
    } catch {
      // Ignore transient buffer errors; they don't stop the session.
    }
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  const stop = async (): Promise<string> => {
    processor.disconnect();
    source.disconnect();
    try {
      await audioContext.close();
    } catch {
      /* already closed */
    }
    recognizer.remove();
    return (finalText + " " + partialText).trim();
  };

  const getTranscript = () => (finalText + " " + partialText).trim();

  return { stop, getTranscript };
}
