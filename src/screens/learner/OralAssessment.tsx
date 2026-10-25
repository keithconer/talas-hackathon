import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import FrogMascot from '../../components/FrogMascot'
import { useSpeechRecognition } from '../../reading/speech'
import {
  readingProgress,
  scoreReading,
  tokenize,
  type ReadingScore,
} from '../../reading/scorer'
import {
  save,
  syncNow,
  uploadRecording,
  isRecordingStorageConfigured,
  type WordResult,
} from '../../data'

/** Result handed to the parent flow when the learner submits the reading. */
export interface OralResult {
  passage: string
  transcript: string
  accuracy: number
  correctWords: number
  totalWords: number
  words: WordResult[]
  audioUrl: string | null
  durationSec: number
  engine: string
}

interface Props {
  onBack: () => void
  onSubmit: (result: OralResult) => void
  /** The logged-in learner's id; the saved attempt is attributed to them. */
  learnerId?: string
  /** Passage text to read. Defaults to the Maya story when not assigned. */
  passageText?: string
  /** Passage/activity id stored on the attempt (carries the level back). */
  passageId?: string
}

const DEFAULT_PASSAGE_ID = 'passage-oral-maya'
const DEFAULT_LEARNER_ID = 'learner-maria' // fallback when no session supplied

const DEFAULT_ORAL_PASSAGE =
  "Masaya si Maya sa bukid. Nakakita siya ng mga paru-paro sa paligid ng mga bulaklak. Tumakbo siya patungo sa kanyang nanay at sinabi, 'Nanay, maganda ang mga paru-paro!' Ngumiti ang kanyang nanay at sinabing, 'Oo, mahal. Ingatan natin sila.'"

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(
    s % 60,
  ).padStart(2, '0')}`
}

/** Even fallback time for skipped words (seconds across the recording). */
function estimateTime(i: number, total: number, dur: number): number | undefined {
  if (dur <= 0) return undefined
  return (i / total) * dur
}

export default function OralAssessment({
  onBack,
  onSubmit,
  learnerId = DEFAULT_LEARNER_ID,
  passageText,
  passageId,
}: Props) {
  // The passage to read + the id stored on the attempt. When the teacher has
  // assigned a Content Bank level, these come in as props; otherwise fall back
  // to the default Maya story.
  const ORAL_PASSAGE = passageText && passageText.trim() ? passageText : DEFAULT_ORAL_PASSAGE
  const PASSAGE_ID = passageId ?? DEFAULT_PASSAGE_ID
  const words = useMemo(() => tokenize(ORAL_PASSAGE), [ORAL_PASSAGE])

  const speech = useSpeechRecognition('fil-PH')
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const finishingRef = useRef(false)
  // Ensures the attempt is persisted at most once per reading.
  const submittedRef = useRef(false)

  const isRecording = speech.isRecording
  const hasStopped = speech.status === 'done'

  // Live reading position from REAL recognized speech (not a timer).
  const progress = useMemo(
    () => readingProgress(ORAL_PASSAGE, speech.transcript),
    [ORAL_PASSAGE, speech.transcript],
  )
  const activeWordIndex = Math.min(progress.cursor, words.length - 1)

  // Real elapsed-time clock while recording.
  useEffect(() => {
    if (!isRecording) return
    const id = setInterval(() => setElapsedSeconds((p) => p + 1), 1000)
    return () => clearInterval(id)
  }, [isRecording])

  const buildResult = useCallback(
    (transcript: string): OralResult => {
      const score: ReadingScore = scoreReading(ORAL_PASSAGE, transcript)
      const total = score.totalWords || 1
      const dur = speech.durationSec || elapsedSeconds || 0
      const timings = speech.getWordTimings()
      const wordsWithTime: WordResult[] = score.words.map((w) => {
        const si = w.spokenIndex ?? -1
        const exact = si >= 0 ? timings[si]?.start : undefined
        return { ...w, timeSec: exact ?? estimateTime(w.index, total, dur) }
      })
      return {
        passage: ORAL_PASSAGE,
        transcript,
        accuracy: score.accuracy,
        correctWords: score.correctWords,
        totalWords: score.totalWords,
        words: wordsWithTime,
        audioUrl: speech.audioUrl,
        durationSec: dur,
        engine: speech.engine,
      }
    },
    [ORAL_PASSAGE, speech, elapsedSeconds],
  )

  // Persist the attempt to IndexedDB (offline-safe, syncs when online).
  const persist = useCallback(
    async (result: OralResult) => {
      const attemptId = `attempt-${PASSAGE_ID}-${Date.now()}`

      // Upload the voice recording to S3 first (best-effort). If online and
      // storage is configured, we store the returned S3 key on the attempt so
      // the teacher can play it back later. If it fails (offline, no endpoint),
      // we still save everything else.
      let audioKey: string | undefined
      const blob = speech.getAudioBlob()
      if (blob && navigator.onLine && isRecordingStorageConfigured()) {
        try {
          audioKey = await uploadRecording(blob, learnerId, attemptId)
        } catch {
          /* upload failed; attempt still saves without the recording key */
        }
      }

      try {
        await save('readingAttempts', {
          id: attemptId,
          passageId: PASSAGE_ID,
          learnerId,
          transcript: result.transcript,
          accuracy: result.accuracy,
          correctWords: result.correctWords,
          totalWords: result.totalWords,
          words: result.words,
          method: result.engine === 'none' ? 'manual' : 'speech-api',
          online: navigator.onLine,
          durationSec: result.durationSec || undefined,
          audioKey,
          createdAt: new Date().toISOString(),
        })
        console.info('[TALAS] Saved reading attempt', attemptId, 'for', learnerId)
        // Push to the cloud database right away. Fire-and-forget: if offline,
        // the record stays dirty in IndexedDB and auto-syncs on reconnect.
        void syncNow()
      } catch (err) {
        // Surface the real cause instead of silently losing the attempt.
        console.error('[TALAS] Failed to save reading attempt:', err)
      }
    },
    [PASSAGE_ID, speech, learnerId],
  )

  const finishReading = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    await speech.stop()
  }, [speech])

  // Auto-stop once the reader reaches the end of the passage.
  useEffect(() => {
    if (
      isRecording &&
      progress.cursor >= words.length &&
      !finishingRef.current
    ) {
      const t = setTimeout(() => void finishReading(), 600)
      return () => clearTimeout(t)
    }
  }, [isRecording, progress.cursor, words.length, finishReading])

  const handleStart = () => {
    finishingRef.current = false
    submittedRef.current = false
    setElapsedSeconds(0)
    void speech.start()
  }

  const handleBack = () => {
    if (window.confirm('Sigurado ka bang gusto mong bumalik?')) {
      speech.reset()
      onBack()
    }
  }

  const handleUlitin = () => {
    finishingRef.current = false
    submittedRef.current = false
    speech.reset()
    setElapsedSeconds(0)
  }

  const handleStop = () => {
    void finishReading()
  }

  const handleSubmit = async () => {
    // Guard against double-submits (fast double-tap, re-render) saving twice.
    if (submittedRef.current) return
    submittedRef.current = true
    const transcript = speech.transcript
    const result = buildResult(transcript)
    await persist(result)
    onSubmit(result)
  }

  const showControls = isRecording || hasStopped || speech.status === 'loading'

  return (
    <div
      style={{
        width: '100%',
        background: 'var(--talas-paper)',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Keyframes for the listening waveform */}
      <style>{`
        @keyframes oralWave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>

      {/* MINIMAL TOP BAR */}
      <div
        style={{
          background: 'white',
          borderBottom: '1px solid var(--talas-line)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            minHeight: '48px',
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            border: 'none',
            background: 'transparent',
            color: 'var(--talas-blue)',
            cursor: 'pointer',
            padding: '0 8px',
          }}
        >
          ← Bumalik
        </button>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: 'var(--font-ui)',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--talas-charcoal)',
          }}
        >
          Pasalitang Pagbasa
        </div>
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            color: '#9CA3AF',
          }}
        >
          {speech.engine === 'vosk'
            ? 'Offline'
            : speech.engine === 'speech-api'
              ? 'Online'
              : navigator.onLine
                ? 'Online'
                : 'Offline'}
        </div>
      </div>

      {/* CONTENT AREA */}
      <div
        style={{
          flex: 1,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* TOP ROW: Mic status + Timer */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Mic panel */}
          <div
            style={{
              width: '120px',
              height: '72px',
              flexShrink: 0,
              background: isRecording ? 'var(--talas-red-soft)' : '#F3F4F6',
              borderRadius: '12px',
              border: isRecording
                ? '1px solid var(--talas-red)'
                : '1px solid var(--talas-line)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <Mic size={22} color={isRecording ? 'var(--talas-red)' : 'var(--talas-muted)'} aria-hidden="true" />
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: isRecording ? 'var(--talas-coral)' : '#9CA3AF',
                fontWeight: isRecording ? 700 : 400,
              }}
            >
              {isRecording ? 'Nakikinig…' : 'Mikropono'}
            </span>
          </div>

          {/* CENTER: listening waveform + status (fills the gap) */}
          <div
            style={{
              flex: 1,
              alignSelf: 'stretch',
              minWidth: 0,
              height: '72px',
              background: isRecording ? 'var(--talas-red-soft)' : '#F9FAFB',
              borderRadius: '12px',
              border: `1px solid ${isRecording ? 'var(--talas-red)' : 'var(--talas-line)'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0 12px',
            }}
          >
            {/* Animated bars */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
              }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: '4px',
                    borderRadius: '2px',
                    background: isRecording
                      ? 'var(--talas-coral)'
                      : hasStopped
                        ? 'var(--talas-green)'
                        : '#D1D5DB',
                    height: isRecording ? '100%' : '30%',
                    transformOrigin: 'center',
                    animation: isRecording
                      ? `oralWave 0.9s ease-in-out ${i * 0.08}s infinite`
                      : 'none',
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                fontWeight: 600,
                color: isRecording
                  ? 'var(--talas-coral)'
                  : hasStopped
                    ? 'var(--talas-green)'
                    : '#9CA3AF',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {speech.status === 'loading'
                ? 'Inihahanda ang mikropono…'
                : isRecording
                  ? 'Nakikinig… basahin nang malakas!'
                  : hasStopped
                    ? 'Tapos na! Pindutin ang Ipasa.'
                    : 'Handa ka na? Basahin nang malakas.'}
            </span>
          </div>

          {/* Timer */}
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '34px',
                fontWeight: 700,
                color: isRecording
                  ? 'var(--talas-coral)'
                  : 'var(--talas-charcoal)',
              }}
            >
              {formatTime(elapsedSeconds)}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: '#9CA3AF',
                textAlign: 'right',
              }}
            >
              Oras
            </div>
          </div>
        </div>

        {/* PASSAGE CARD */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            background: 'white',
            borderRadius: '14px',
            padding: 'clamp(18px, 4vw, 40px)',
            border: '1px solid var(--talas-line)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--talas-green)',
              marginBottom: '8px',
            }}
          >
            BASAHIN NANG MALAKAS
          </div>
          {/* Words — highlighted from REAL recognized speech */}
          <div
            style={{
              fontFamily: 'var(--font-reading)',
              fontSize: 'clamp(20px, 3vw, 32px)',
              lineHeight: 1.8,
            }}
          >
            {words.map((word, index) => {
              const isRead = progress.read[index] === true
              const isCurrent = isRecording && index === activeWordIndex && !isRead
              let spanStyle: React.CSSProperties
              if (isRead) {
                spanStyle = { color: 'var(--talas-green)', opacity: 0.65 }
              } else if (isCurrent) {
                spanStyle = {
                  background: 'var(--talas-yellow)',
                  color: 'var(--talas-charcoal)',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  fontWeight: 700,
                }
              } else {
                spanStyle = { color: 'var(--talas-charcoal)' }
              }
              return (
                <span key={index} style={spanStyle}>
                  {word}
                  {index < words.length - 1 ? ' ' : ''}
                </span>
              )
            })}
          </div>
          {/* Progress bar — driven by recognized words */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: '#9CA3AF',
              }}
            >
              Simula
            </span>
            <div
              style={{
                flex: 1,
                height: '6px',
                background: '#E5E7EB',
                borderRadius: '3px',
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    100,
                    (progress.cursor / words.length) * 100,
                  )}%`,
                  height: '100%',
                  background: 'var(--talas-blue)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: '#9CA3AF',
              }}
            >
              {Math.min(progress.cursor, words.length)} / {words.length} salita
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '11px',
                color: '#9CA3AF',
              }}
            >
              Katapusan
            </span>
          </div>
        </div>

        {/* FROG ENCOURAGEMENT STRIP */}
        <div
          style={{
            background: 'var(--talas-mint)',
            borderRadius: '12px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <FrogMascot size={40} />
          <span
            style={{
              fontFamily: 'var(--font-reading)',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--talas-green)',
            }}
          >
            {hasStopped ? 'Tapos ka na! Pindutin ang Ipasa.' : "Kaya mo 'yan!"}
          </span>
        </div>

        {speech.error && (
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--talas-coral)',
              fontWeight: 600,
            }}
          >
            {speech.error}
          </div>
        )}

        {/* RECORDING CONTROLS */}
        {!showControls ? (
          <button
            type="button"
            onClick={handleStart}
            style={{
              width: '100%',
              minHeight: '56px',
              background: 'var(--talas-blue)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Simulan ang Pagbasa
          </button>
        ) : speech.status === 'loading' ? (
          <button
            type="button"
            disabled
            style={{
              width: '100%',
              minHeight: '56px',
              background: '#9CA3AF',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontFamily: 'var(--font-ui)',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'default',
            }}
          >
            Inihahanda…
          </button>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {/* Ulitin */}
            <button
              type="button"
              onClick={handleUlitin}
              style={{
                border: '1px solid var(--talas-line)',
                background: 'transparent',
                color: 'var(--talas-charcoal)',
                borderRadius: '12px',
                minHeight: '52px',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ulitin
            </button>
            {/* Ihinto */}
            <button
              type="button"
              disabled={!isRecording}
              onClick={handleStop}
              style={{
                border: '1px solid var(--talas-red)',
                background: 'transparent',
                color: 'var(--talas-coral)',
                borderRadius: '12px',
                minHeight: '52px',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isRecording ? 'pointer' : 'not-allowed',
                opacity: isRecording ? 1 : 0.4,
              }}
            >
              Ihinto
            </button>
            {/* Ipasa */}
            <button
              type="button"
              disabled={!hasStopped}
              onClick={() => void handleSubmit()}
              style={{
                background: hasStopped ? 'var(--talas-blue)' : '#E5E7EB',
                color: hasStopped ? 'white' : '#6B7280',
                border: 'none',
                borderRadius: '12px',
                minHeight: '52px',
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: hasStopped ? 'pointer' : 'not-allowed',
              }}
            >
              Ipasa →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
