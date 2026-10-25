/**
 * TALAS — speech recognition + audio capture hook for oral reading.
 *
 * Recognition engines, in order of preference:
 *
 *  1. Vosk (WebAssembly, on-device) — works fully OFFLINE. Used whenever a Vosk
 *     model is bundled/cached. This is the primary engine for TALAS because
 *     classrooms may have no connection.
 *  2. Web Speech API — only when online and no Vosk model is present. It streams
 *     audio to a vendor server, so it cannot work offline.
 *  3. Recording-only + manual transcript — final fallback. Audio is still
 *     captured via MediaRecorder for teacher review, and the UI can accept a
 *     typed transcript that the on-device scorer grades identically.
 *
 * Scoring itself is always on-device, so results are identical offline/online.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_MODEL_URL,
  isModelAvailable,
  startVosk,
  type VoskSession,
  type VoskWord,
} from "./vosk";

/* ----------------------------- Web Speech API typings (not in DOM lib) --- */

interface SpeechRecognitionResultLike {
  readonly transcript: string;
}
interface SpeechRecognitionResultEntry {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultLike;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  item(index: number): SpeechRecognitionResultEntry;
  [index: number]: SpeechRecognitionResultEntry;
}
interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* --------------------------------------------------------------- Hook ---- */

export type RecordingStatus = "idle" | "loading" | "recording" | "done" | "error";

/** Which engine actually transcribed (or is transcribing) the reading. */
export type RecognitionEngine = "vosk" | "speech-api" | "none";

export interface SpeechRecognitionState {
  transcript: string;
  status: RecordingStatus;
  isRecording: boolean;
  /** Engine currently in use (or that produced the last transcript). */
  engine: RecognitionEngine;
  /** True once we've confirmed an offline (Vosk) model is available. */
  offlineReady: boolean;
  /** Whether the Web Speech API exists in this browser. */
  speechApiSupported: boolean;
  /** Whether transcription produced any text (vs. recording-only). */
  transcriptAvailable: boolean;
  audioUrl: string | null;
  durationSec: number;
  error: string | null;
  start: () => Promise<void>;
  /** Stops recognition and resolves with the final transcript. */
  stop: () => Promise<string>;
  reset: () => void;
  setManualTranscript: (text: string) => void;
  /**
   * Accurate per-word audio timings (seconds) when the Vosk engine was used.
   * Empty for the Web Speech API, which exposes no per-word offsets.
   */
  getWordTimings: () => VoskWord[];
  /** The recorded audio Blob (for uploading to storage), or null. */
  getAudioBlob: () => Blob | null;
}

export function useSpeechRecognition(
  lang = "fil-PH",
  modelUrl = DEFAULT_MODEL_URL,
): SpeechRecognitionState {
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [engine, setEngine] = useState<RecognitionEngine>("none");
  const [offlineReady, setOfflineReady] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcriptAvailable, setTranscriptAvailable] = useState(false);

  const voskRef = useRef<VoskSession | null>(null);
  // Per-word timings (seconds into the recording). Populated live by whichever
  // engine is active — Vosk reports real offsets; the Web Speech API path
  // stamps each new word against the recording clock as it is first heard.
  const wordTimingsRef = useRef<VoskWord[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const finalRef = useRef("");
  const startTimeRef = useRef(0);
  // High-resolution timestamp (performance.now) of when the recorder actually
  // started — the zero point for all word offsets.
  const recClockRef = useRef(0);
  // Always holds the latest transcript, immune to React render closures so
  // stop() can return the real final text (fixes "live correct, final wrong").
  const transcriptRef = useRef("");

  /** Single place to update the transcript: keeps state + ref in lockstep. */
  const applyTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
    if (text.trim().length > 0) setTranscriptAvailable(true);
  }, []);

  const speechApiSupported = getSpeechRecognitionCtor() !== null;

  // Probe for an offline model once on mount, so the UI can tell the learner
  // whether offline recognition will work before they start.
  useEffect(() => {
    let cancelled = false;
    isModelAvailable(modelUrl).then((ok) => {
      if (!cancelled) setOfflineReady(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [modelUrl]);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setTranscriptAvailable(false);
    setEngine("none");
    finalRef.current = "";
    transcriptRef.current = "";
    wordTimingsRef.current = [];
    chunksRef.current = [];
    audioBlobRef.current = null;
    recClockRef.current = 0;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDurationSec(0);
    startTimeRef.current = Date.now();
    setStatus("loading");

    // 1) Capture the mic once; both the recorder and recognizers share it.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
    } catch {
      setError("Hindi ma-access ang mikropono.");
      setStatus("error");
      return;
    }

    // 2) Always record audio for teacher review.
    try {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      // Zero point for word offsets: the instant recording truly begins.
      recorder.onstart = () => {
        recClockRef.current = performance.now();
      };
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          audioBlobRef.current = blob;
          setAudioUrl(URL.createObjectURL(blob));
        }
        setDurationSec(Math.round((Date.now() - startTimeRef.current) / 1000));
      };
      recorder.start();
    } catch {
      // Recording is best-effort; recognition can still proceed.
    }

    // 3a) Prefer Vosk (offline). Try whenever a model is available.
    if (offlineReady) {
      try {
        const session = await startVosk(
          stream,
          {
            onPartial: (text) => applyTranscript(text),
            onResult: (text) => applyTranscript(text),
            onWords: (words) => {
              wordTimingsRef.current = words;
            },
            onError: (msg) => setError(msg),
          },
          modelUrl,
        );
        voskRef.current = session;
        setEngine("vosk");
        setStatus("recording");
        return;
      } catch {
        // Model failed to load; fall through to the next engine.
        setError("Hindi na-load ang offline na modelo. Susubukan ang iba.");
      }
    }

    // 3b) Web Speech API — online only.
    const Ctor = getSpeechRecognitionCtor();
    if (Ctor && navigator.onLine) {
      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        // Rebuild the whole transcript from the full results list every time.
        // The results list is cumulative, so rebuilding (instead of appending)
        // avoids double-counting and keeps the final text consistent with what
        // was shown live.
        let combined = "";
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          combined += (result[0]?.transcript ?? "") + " ";
        }
        const trimmed = combined.trim();

        // Exact word timing: the instant a NEW word first appears in the
        // (interim) transcript is the moment the learner said it. Stamp each
        // newly-appeared word with the elapsed recording time right now. This
        // is captured live from the real audio clock — not estimated.
        const nowSec =
          recClockRef.current > 0
            ? (performance.now() - recClockRef.current) / 1000
            : 0;
        const spokenWords = trimmed.split(/\s+/).filter(Boolean);
        const timings = wordTimingsRef.current;
        for (let i = timings.length; i < spokenWords.length; i++) {
          timings.push({ word: spokenWords[i], start: nowSec, end: nowSec });
        }
        // If the recognizer revised the tail (interim words change), update the
        // trailing word text without touching earlier, settled timings.
        for (let i = 0; i < spokenWords.length && i < timings.length; i++) {
          timings[i].word = spokenWords[i];
        }

        applyTranscript(trimmed);
      };
      recognition.onerror = (e) => {
        setError(
          e.error === "network"
            ? "Walang koneksyon para sa live na pagkilala ng boses."
            : e.error,
        );
      };
      recognition.onend = () => {
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setEngine("speech-api");
      } catch {
        recognitionRef.current = null;
      }
    }

    // 3c) Whatever happened, we're now recording (possibly recording-only).
    setStatus("recording");
  }, [applyTranscript, audioUrl, lang, modelUrl, offlineReady]);

  const stop = useCallback(async () => {
    // Stop whichever recognizer is active and capture its final transcript.
    if (voskRef.current) {
      const finalText = await voskRef.current.stop();
      voskRef.current = null;
      if (finalText.trim()) applyTranscript(finalText);
    }

    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      // The Web Speech API may emit one last `onresult` (final segment) AFTER
      // stop() is called. Wait for `onend` (bounded) so transcriptRef holds the
      // true final text before we return it for scoring.
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        rec.onend = finish;
        try {
          rec.stop();
        } catch {
          finish();
        }
        // Safety timeout so we never hang if `onend` doesn't fire.
        setTimeout(finish, 1200);
      });
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    cleanupStream();
    setStatus("done");
    return transcriptRef.current;
  }, [applyTranscript, cleanupStream]);

  const reset = useCallback(() => {
    voskRef.current?.stop();
    voskRef.current = null;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    cleanupStream();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setTranscript("");
    setTranscriptAvailable(false);
    setEngine("none");
    finalRef.current = "";
    transcriptRef.current = "";
    wordTimingsRef.current = [];
    recClockRef.current = 0;
    chunksRef.current = [];
    audioBlobRef.current = null;
    setDurationSec(0);
    setError(null);
    setStatus("idle");
  }, [audioUrl, cleanupStream]);

  const setManualTranscript = useCallback((text: string) => {
    setTranscript(text);
    setTranscriptAvailable(text.trim().length > 0);
  }, []);

  const getWordTimings = useCallback(() => wordTimingsRef.current, []);
  const getAudioBlob = useCallback(() => audioBlobRef.current, []);

  useEffect(() => {
    return () => {
      voskRef.current?.stop();
      recognitionRef.current?.abort();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return {
    transcript,
    status,
    isRecording: status === "recording",
    engine,
    offlineReady,
    speechApiSupported,
    transcriptAvailable,
    audioUrl,
    durationSec,
    error,
    start,
    stop,
    reset,
    setManualTranscript,
    getWordTimings,
    getAudioBlob,
  };
}
