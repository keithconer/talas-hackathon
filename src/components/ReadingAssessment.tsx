import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './ReadingAssessment.css'
import {
  getAll,
  save,
  syncNow,
  useOnline,
  type ReadingPassage,
} from '../data'
import { useSpeechRecognition } from '../reading/speech'
import {
  accuracyBand,
  readingProgress,
  scoreReading,
  tokenize,
  type ReadingScore,
} from '../reading/scorer'

/* ------------------------------------------------------------------ Icons */
type IconProps = { className?: string }
const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}
function IconMic({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v4M9 21h6" />
    </svg>
  )
}
function IconStop({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor" />
    </svg>
  )
}
function IconBack({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" {...s} aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

const LEARNER_ID = 'learner-maria' // demo learner; a real session would supply this

type Phase = 'pick' | 'read' | 'result'

/** Even fallback for skipped words: spread word `i` across the recording. */
function estimateTime(i: number, total: number, dur: number): number | undefined {
  if (dur <= 0) return undefined
  return (i / total) * dur
}

export default function ReadingAssessment({ onExit }: { onExit?: () => void }) {
  const online = useOnline()
  const [passages, setPassages] = useState<ReadingPassage[]>([])
  const [passage, setPassage] = useState<ReadingPassage | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [score, setScore] = useState<ReadingScore | null>(null)
  const [saved, setSaved] = useState(false)
  const [manual, setManual] = useState('')
  const [playTime, setPlayTime] = useState(0)

  const speech = useSpeechRecognition('fil-PH')

  // Guards so auto-finish fires at most once per reading attempt.
  const finishingRef = useRef(false)
  // Audio element in the review, for click-to-seek.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recStartRef = useRef(0)

  // Load passages from IndexedDB (works offline).
  useEffect(() => {
    getAll('readingPassages')
      .then((all) =>
        setPassages(all.filter((p) => p.deleted !== true)),
      )
      .catch(() => setPassages([]))
  }, [])

  const passageTokens = useMemo(
    () => (passage ? tokenize(passage.body) : []),
    [passage],
  )

  // Position-aware live progress: walks the transcript through the passage in
  // order so out-of-order words don't light up early and repeated words are
  // matched one at a time. `cursor` is the next word to read.
  const progress = useMemo(
    () => readingProgress(passage?.body ?? '', speech.transcript),
    [passage, speech.transcript],
  )

  function choosePassage(p: ReadingPassage) {
    speech.reset()
    finishingRef.current = false
    setPassage(p)
    setScore(null)
    setSaved(false)
    setManual('')
    setPlayTime(0)
    setPhase('read')
  }

  const finishAndScore = useCallback(async () => {
    if (!passage || finishingRef.current) return
    finishingRef.current = true
    // stop() returns the TRUE final transcript (it waits for the recognizer to
    // flush). Score exactly that — not React state, which can be stale and
    // caused "correct while reading, wrong at the end".
    const finalTranscript = await speech.stop()
    const transcript = finalTranscript.trim() ? finalTranscript : manual
    const result = scoreReading(passage.body, transcript)

    const total = result.totalWords || 1
    const dur = speech.durationSec || 0
    // Exact timings captured live, one per SPOKEN word, against the recording
    // clock. Each passage word knows which spoken word matched it (spokenIndex),
    // so we attach the precise time of the word the learner actually said.
    const spokenTimings = speech.getWordTimings()
    result.words = result.words.map((w) => {
      const si = w.spokenIndex ?? -1
      const exact = si >= 0 ? spokenTimings[si]?.start : undefined
      return {
        ...w,
        // Fall back to an even estimate only for words that were never matched
        // (skipped) so clicking them still lands somewhere sensible.
        timeSec: exact ?? estimateTime(w.index, total, dur),
      }
    })

    setScore(result)
    setPhase('result')
    recStartRef.current = 0
  }, [passage, speech, manual])

  // Reset timing capture when a new recording starts.
  useEffect(() => {
    if (speech.isRecording && recStartRef.current === 0) {
      recStartRef.current = Date.now()
    }
    if (!speech.isRecording && speech.status === 'idle') {
      recStartRef.current = 0
    }
  }, [speech.isRecording, speech.status])

  // Auto-finish: once the learner is recording and the reading cursor has
  // reached the end of the passage (every word read in order), stop recognition
  // and score automatically — no need to tap "Tapos na ako".
  useEffect(() => {
    if (
      phase === 'read' &&
      speech.isRecording &&
      passageTokens.length > 0 &&
      progress.cursor >= passageTokens.length &&
      !finishingRef.current
    ) {
      // Small grace period so the recognizer can flush its final word before we
      // stop and score.
      const t = setTimeout(() => void finishAndScore(), 600)
      return () => clearTimeout(t)
    }
  }, [
    phase,
    speech.isRecording,
    progress.cursor,
    passageTokens.length,
    finishAndScore,
  ])

  async function scoreManual() {
    if (!passage) return
    const result = scoreReading(passage.body, manual)
    setScore(result)
    setPhase('result')
  }

  // Click a word in the review to jump the recording to when it was read.
  function seekToWord(timeSec?: number) {
    const audio = audioRef.current
    if (!audio || timeSec === undefined) return
    audio.currentTime = Math.max(0, timeSec)
    void audio.play().catch(() => {
      /* autoplay may be blocked until a user gesture — the click counts */
    })
  }

  async function saveAttempt() {
    if (!passage || !score) return
    await save('readingAttempts', {
      id: `attempt-${passage.id}-${Date.now()}`,
      passageId: passage.id,
      learnerId: LEARNER_ID,
      transcript: speech.transcriptAvailable ? speech.transcript : manual,
      accuracy: score.accuracy,
      correctWords: score.correctWords,
      totalWords: score.totalWords,
      words: score.words,
      method: speech.engine === 'none' ? 'manual' : 'speech-api',
      online,
      durationSec: speech.durationSec || undefined,
      createdAt: new Date().toISOString(),
    })
    // Push to the cloud database immediately (offline-safe: stays dirty and
    // auto-syncs on reconnect if there's no connection right now).
    void syncNow()
    setSaved(true)
  }

  function restart() {
    speech.reset()
    finishingRef.current = false
    setScore(null)
    setSaved(false)
    setManual('')
    setPlayTime(0)
    setPhase('read')
  }

  const band = score ? accuracyBand(score.accuracy) : null

  return (
    <div className="ra-page">
      <header className="ra-top">
        <button
          className="ra-link"
          onClick={() => (phase === 'pick' ? onExit?.() : setPhase('pick'))}
        >
          <IconBack className="ra-link-ic" /> {phase === 'pick' ? 'Home' : 'Mga kuwento'}
        </button>
        <span className="ra-brand">TALAS · Reading Assessment</span>
        <span className={`ra-net ${online ? 'is-on' : 'is-off'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {/* ------------------------------------------------------ Pick a story */}
      {phase === 'pick' && (
        <section className="ra-pick">
          <h1>Pumili ng kuwento</h1>
          <p className="ra-sub">Basahin ito nang malakas. Pakikinggan ka namin.</p>
          <div className="ra-cards">
            {passages.map((p) => (
              <button
                key={p.id}
                className="ra-story-card"
                onClick={() => choosePassage(p)}
              >
                <span className={`ra-level ra-${p.level}`}>
                  {p.level.replace('antas-', 'Antas ')}
                </span>
                <strong>{p.title}</strong>
                <small>{p.wordCount} salita</small>
              </button>
            ))}
            {passages.length === 0 && (
              <p className="ra-empty">Walang kuwentong available.</p>
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------------- Reading */}
      {phase === 'read' && passage && (
        <section className="ra-read">
          <div className="ra-read-head">
            <span className={`ra-level ra-${passage.level}`}>
              {passage.level.replace('antas-', 'Antas ')}
            </span>
            <h1>{passage.title}</h1>
          </div>

          <p className="ra-passage">
            {passageTokens.map((word, i) => {
              const isRead = progress.read[i] === true
              const isCurrent = speech.isRecording && i === progress.cursor
              const cls = isRead
                ? 'is-heard'
                : isCurrent
                  ? 'is-current'
                  : ''
              return (
                <span key={i} className={`ra-word ${cls}`}>
                  {word}{' '}
                </span>
              )
            })}
          </p>

          {/* Engine status so the learner/teacher knows how reading is checked. */}
          <div className="ra-engine">
            {speech.offlineReady ? (
              <span className="ra-engine-tag is-offline-ok">
                Offline voice check handa (Vosk)
              </span>
            ) : online && speech.speechApiSupported ? (
              <span className="ra-engine-tag is-online">
                Online voice check
              </span>
            ) : (
              <span className="ra-engine-tag is-manual">
                Recording-only · i-type ang binasa
              </span>
            )}
          </div>

          <div className="ra-controls">
            {speech.status === 'loading' ? (
              <button className="ra-rec is-loading" disabled>
                <span className="ra-spinner" />
                Inihahanda…
              </button>
            ) : !speech.isRecording ? (
              <button className="ra-rec" onClick={() => void speech.start()}>
                <IconMic className="ra-rec-ic" />
                Magsimulang magbasa
              </button>
            ) : (
              <button
                className="ra-rec is-recording"
                onClick={() => void finishAndScore()}
              >
                <IconStop className="ra-rec-ic" />
                Tapos na ako
              </button>
            )}
            {speech.isRecording && (
              <>
                <span className="ra-rec-hint">
                  <span className="ra-pulse" />{' '}
                  {speech.engine === 'none'
                    ? 'Nagre-record… titigil kapag tapos ka na'
                    : 'Nakikinig… titigil kapag tapos ka na'}
                </span>
                {passageTokens.length > 0 && (
                  <div
                    className="ra-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={passageTokens.length}
                    aria-valuenow={Math.min(
                      progress.cursor,
                      passageTokens.length,
                    )}
                  >
                    <span
                      style={{
                        width: `${Math.min(
                          100,
                          (progress.cursor / passageTokens.length) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                )}
                <small className="ra-progress-label">
                  {Math.min(progress.cursor, passageTokens.length)} /{' '}
                  {passageTokens.length} na salita
                </small>
              </>
            )}
          </div>

          {/* Manual fallback: only when recognition can't transcribe — no
              offline model AND (offline or no Web Speech API). */}
          {!speech.offlineReady &&
            (!speech.speechApiSupported || !online) &&
            !speech.isRecording &&
            speech.status !== 'loading' && (
              <div className="ra-manual">
                <p className="ra-manual-note">
                  {online
                    ? 'Walang offline na modelo at hindi suportado ang live na pagkilala sa browser na ito.'
                    : 'Offline ka ngayon at walang naka-install na offline na modelo. Nai-record pa rin ang boses para sa guro.'}{' '}
                  I-type ang binasa upang masuri.
                </p>
                <textarea
                  className="ra-manual-input"
                  placeholder="I-type dito ang binasa ng mag-aaral…"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  rows={3}
                />
                <button
                  className="ra-btn-secondary"
                  disabled={manual.trim().length === 0}
                  onClick={scoreManual}
                >
                  Suriin ang binasa
                </button>
              </div>
            )}

          {speech.error && <p className="ra-error">{speech.error}</p>}
        </section>
      )}

      {/* ------------------------------------------------------------ Result */}
      {phase === 'result' && score && passage && band && (
        <section className="ra-result">
          <div className={`ra-score ra-score-${band.tone}`}>
            <span className="ra-score-num">{score.accuracy}%</span>
            <span className="ra-score-label">{band.label}</span>
          </div>

          <div className="ra-stats">
            <div className="ra-stat">
              <strong>{score.correctWords}</strong>
              <small>Tama</small>
            </div>
            <div className="ra-stat">
              <strong>{score.totalWords - score.correctWords}</strong>
              <small>Mali / Nalaktawan</small>
            </div>
            <div className="ra-stat">
              <strong>{score.totalWords}</strong>
              <small>Kabuuang salita</small>
            </div>
          </div>

          {speech.audioUrl && (
            <div className="ra-audio-block">
              <h2>Recording para sa guro</h2>
              <audio
                ref={audioRef}
                controls
                src={speech.audioUrl}
                className="ra-audio-el"
                onTimeUpdate={(e) =>
                  setPlayTime(e.currentTarget.currentTime)
                }
              />
              {speech.durationSec > 0 && (
                <small className="ra-dur">{speech.durationSec}s na recording</small>
              )}
            </div>
          )}

          <div className="ra-review">
            <h2>Pagsusuri ng pagbasa</h2>
            {speech.audioUrl && (
              <p className="ra-review-hint">
                I-click ang salita para lumukso ang recording sa bahaging iyon.
              </p>
            )}
            <p className="ra-passage ra-passage-review">
              {score.words.map((w) => {
                const active =
                  w.timeSec !== undefined &&
                  playTime >= w.timeSec &&
                  (score.words[w.index + 1]?.timeSec === undefined ||
                    playTime < (score.words[w.index + 1]?.timeSec ?? Infinity))
                return (
                  <button
                    key={w.index}
                    type="button"
                    className={`ra-word ra-word-btn ${
                      w.correct ? 'is-correct' : 'is-wrong'
                    } ${active && speech.audioUrl ? 'is-playing' : ''}`}
                    onClick={() => seekToWord(w.timeSec)}
                    disabled={!speech.audioUrl || w.timeSec === undefined}
                    title={
                      w.timeSec !== undefined
                        ? `${w.timeSec.toFixed(1)}s`
                        : undefined
                    }
                  >
                    {w.expected}
                  </button>
                )
              })}
            </p>
            <div className="ra-legend">
              <span><i className="ra-dot-green" /> Tama</span>
              <span><i className="ra-dot-coral" /> Mali / Nalaktawan</span>
            </div>
          </div>

          <div className="ra-result-actions">
            {!saved ? (
              <button className="ra-btn-primary" onClick={saveAttempt}>
                I-save ang resulta
              </button>
            ) : (
              <span className="ra-saved">
                 Nai-save{online ? ' at mai-sync kapag online' : ' (mai-sync kapag online)'}
              </span>
            )}
            <button className="ra-btn-secondary" onClick={restart}>
              Subukan muli
            </button>
            <button className="ra-btn-ghost" onClick={() => setPhase('pick')}>
              Ibang kuwento
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
