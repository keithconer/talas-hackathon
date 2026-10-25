import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mic, Play, Clock, User, Check } from 'lucide-react'
import {
  getById,
  syncNow,
  getRecordingUrl,
  isRecordingStorageConfigured,
  type ReadingAttempt,
} from '../../../data'
import { LEARNERS } from '../dashboard/sectionData'

function learnerName(id: string): string {
  return LEARNERS.find((l) => l.id === id)?.name ?? id
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

function band(accuracy: number): { label: string; cls: string } {
  if (accuracy >= 80) return { label: 'Strong', cls: 'bg-sprout-50 text-sprout-500' }
  if (accuracy >= 60) return { label: 'Average', cls: 'bg-sky-50 text-sky-500' }
  return { label: 'Needs support', cls: 'bg-coral-50 text-coral-500' }
}

/** Full review page for a single submitted oral reading attempt. */
function ReviewAssessment() {
  const navigate = useNavigate()
  const { activityId } = useParams()

  const [attempt, setAttempt] = useState<ReadingAttempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [playTime, setPlayTime] = useState(0)
  const [reviewed, setReviewed] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load the attempt (sync first so cross-device submissions are available).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await syncNow()
      } catch {
        /* offline / no endpoint */
      }
      const rec = activityId
        ? await getById('readingAttempts', activityId)
        : undefined
      if (!cancelled) {
        setAttempt(rec ?? null)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activityId])

  const handlePlay = async () => {
    if (!attempt?.audioKey) return
    if (!audioUrl) {
      setLoadingAudio(true)
      const url =
        isRecordingStorageConfigured() && attempt.audioKey
          ? await getRecordingUrl(attempt.audioKey).catch(() => null)
          : null
      setLoadingAudio(false)
      if (!url) return
      setAudioUrl(url)
    }
    setTimeout(() => void audioRef.current?.play().catch(() => {}), 0)
  }

  const seekToWord = (timeSec?: number) => {
    const audio = audioRef.current
    if (!audio || timeSec === undefined) return
    audio.currentTime = Math.max(0, timeSec)
    void audio.play().catch(() => {})
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <BackLink onClick={() => navigate('/teacher/activities')} />
        <p className="font-sans text-sm text-gray-400">Loading submission…</p>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="space-y-6">
        <BackLink onClick={() => navigate('/teacher/activities')} />
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center font-sans text-gray-500">
          Submission <span className="font-semibold text-charcoal">{activityId}</span> was not
          found.
        </div>
      </div>
    )
  }

  const b = band(attempt.accuracy)

  return (
    <div className="space-y-6">
      <BackLink onClick={() => navigate('/teacher/activities')} />

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-charcoal">Review Assessment</h1>
          <p className="font-sans text-sm text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4" aria-hidden />
              <button
                type="button"
                onClick={() => navigate(`/teacher/learners/${attempt.learnerId}`)}
                className="font-semibold text-charcoal hover:text-sprout-500 transition-colors"
              >
                {learnerName(attempt.learnerId)}
              </button>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4" aria-hidden /> {fmtDate(attempt.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mic className="w-4 h-4" aria-hidden /> Oral Reading
            </span>
          </p>
        </div>
        {reviewed ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sprout-50 text-sprout-500 font-sans text-sm font-bold">
            <Check className="w-4 h-4" aria-hidden /> Reviewed
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setReviewed(true)}
            className="h-11 px-5 rounded-xl bg-sprout-500 hover:opacity-95 text-white font-sans text-sm font-semibold inline-flex items-center gap-2 transition-all shadow-sm"
          >
            <Check className="w-4 h-4" aria-hidden /> Mark as reviewed
          </button>
        )}
      </header>

      {/* Score summary */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard value={`${attempt.accuracy}%`} label="Accuracy" accent={b.cls} />
        <StatCard value={String(attempt.correctWords)} label="Correct" />
        <StatCard
          value={String(attempt.totalWords - attempt.correctWords)}
          label="Wrong / skipped"
        />
        <StatCard
          value={attempt.durationSec ? `${attempt.durationSec}s` : '—'}
          label="Duration"
        />
      </section>

      {/* Recording */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-base font-bold text-charcoal">Recording</h2>
        </div>
        {attempt.audioKey ? (
          !audioUrl ? (
            <button
              type="button"
              onClick={() => void handlePlay()}
              disabled={loadingAudio}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sprout-500 text-white font-sans text-sm font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              <Play className="w-4 h-4" aria-hidden />
              {loadingAudio ? 'Loading…' : 'Play recording'}
            </button>
          ) : (
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
              onTimeUpdate={(e) => setPlayTime(e.currentTarget.currentTime)}
            />
          )
        ) : (
          <p className="font-sans text-sm text-gray-400">
            No recording was uploaded for this attempt.
          </p>
        )}
      </section>

      {/* Passage review — click a word to seek the recording */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-charcoal">Reading Review</h2>
          <div className="flex items-center gap-3 font-sans text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sprout-500" /> Correct
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-coral-500" /> Miscue
            </span>
          </div>
        </div>
        {attempt.audioKey && (
          <p className="font-sans text-xs text-gray-400">
            Click a word to jump the recording to that moment.
          </p>
        )}
        <p className="font-reading text-lg leading-loose">
          {attempt.words.map((w) => {
            const next = attempt.words[w.index + 1]?.timeSec
            const active =
              audioUrl != null &&
              w.timeSec !== undefined &&
              playTime >= w.timeSec &&
              (next === undefined || playTime < next)
            return (
              <button
                key={w.index}
                type="button"
                onClick={() => seekToWord(w.timeSec)}
                disabled={!audioUrl || w.timeSec === undefined}
                title={w.timeSec !== undefined ? `${w.timeSec.toFixed(1)}s` : undefined}
                className={`font-reading mx-0.5 mb-1 px-1 rounded ${
                  audioUrl && w.timeSec !== undefined ? 'cursor-pointer' : 'cursor-default'
                } ${
                  active
                    ? 'bg-sky-100 text-sky-600 ring-2 ring-sky-400'
                    : w.correct
                      ? 'bg-sprout-50 text-sprout-600'
                      : 'bg-coral-50 text-coral-500'
                }`}
              >
                {w.expected}
              </button>
            )
          })}
        </p>

        {/* Transcript of what the recognizer heard */}
        {attempt.transcript && (
          <div className="pt-2 border-t border-gray-100">
            <span className="font-sans text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recognized transcript
            </span>
            <p className="font-reading text-sm text-gray-600 mt-1">{attempt.transcript}</p>
          </div>
        )}
      </section>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-sans text-sm text-charcoal transition-colors"
    >
      <ArrowLeft className="w-4 h-4" aria-hidden /> Back to Activities
    </button>
  )
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string
  label: string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
      <div
        className={`inline-flex items-center justify-center font-display text-2xl font-bold ${
          accent ? `${accent} rounded-lg px-2` : 'text-charcoal'
        }`}
      >
        {value}
      </div>
      <p className="font-sans text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default ReviewAssessment
