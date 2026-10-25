import { useRef, useState } from 'react'
import { Mic, Play, Clock } from 'lucide-react'
import type { ReadingAttempt } from '../../../data'
import { profileFromAccuracy, CRLA_PROFILE_LABEL } from '../../../reading/crla'
import { useReadingAttempts, resolveRecordingUrl } from './useReadingAttempts'
import Pagination from '../shared/Pagination'

const PAGE_SIZE = 5

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/**
 * CRLA proficiency chip for an attempt, derived from oral-reading accuracy via
 * the shared standard (reading/crla.ts). Shows the profile code + label, e.g.
 * "GR · Grade Ready".
 */
function band(accuracy: number): { label: string; cls: string } {
  const level = profileFromAccuracy(accuracy)
  const label = `${level} · ${CRLA_PROFILE_LABEL[level]}`
  if (level === 'GR') return { label, cls: 'bg-sprout-50 text-sprout-500' }
  if (level === 'LR') return { label, cls: 'bg-sky-50 text-sky-500' }
  if (level === 'MR') return { label, cls: 'bg-amber-50 text-amber-600' }
  return { label, cls: 'bg-coral-50 text-coral-500' }
}

/** One submitted oral reading attempt, with score, word review, and recording. */
function AttemptCard({ attempt }: { attempt: ReadingAttempt }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [playTime, setPlayTime] = useState(0)
  const b = band(attempt.accuracy)

  const handlePlay = async () => {
    if (!audioUrl) {
      setLoadingAudio(true)
      const url = await resolveRecordingUrl(attempt.audioKey)
      setLoadingAudio(false)
      if (!url) return
      setAudioUrl(url)
    }
    // Let the <audio> mount, then play.
    setTimeout(() => void audioRef.current?.play().catch(() => {}), 0)
  }

  const seekToWord = (timeSec?: number) => {
    const audio = audioRef.current
    if (!audio || timeSec === undefined) return
    audio.currentTime = Math.max(0, timeSec)
    void audio.play().catch(() => {})
  }

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2.5">
      {/* Header: score + meta */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 text-charcoal font-sans text-xs font-medium">
            <Mic className="w-3.5 h-3.5" aria-hidden /> Oral Reading
          </span>
          <span className={`px-2 py-0.5 rounded-full font-sans text-xs font-bold ${b.cls}`}>
            {b.label}
          </span>
        </div>
        <span className="font-sans text-xs text-gray-400 inline-flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" aria-hidden /> {fmtDate(attempt.createdAt)}
        </span>
      </div>

      {/* Score line */}
      <div className="flex items-center gap-4">
        <span className="font-display text-xl font-bold text-charcoal">
          {attempt.accuracy}%
        </span>
        <span className="font-sans text-sm text-gray-500">
          {attempt.correctWords} / {attempt.totalWords} tama
        </span>
        {attempt.durationSec ? (
          <span className="font-sans text-xs text-gray-400">{attempt.durationSec}s</span>
        ) : null}
      </div>

      {/* Recording */}
      {attempt.audioKey ? (
        <div className="space-y-2">
          {!audioUrl ? (
            <button
              type="button"
              onClick={() => void handlePlay()}
              disabled={loadingAudio}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sprout-500 text-white font-sans text-sm font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity"
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
          )}
        </div>
      ) : (
        <p className="font-sans text-xs text-gray-400">No recording uploaded for this attempt.</p>
      )}

      {/* Word-by-word review — click a word to seek the recording */}
      <div className="font-reading text-base leading-relaxed">
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
      </div>
    </div>
  )
}

/** Teacher view of a learner's submitted oral reading attempts (synced). */
export default function ReadingAttempts({ learnerId }: { learnerId: string | undefined }) {
  const { attempts, loading, refresh } = useReadingAttempts(learnerId)
  const [page, setPage] = useState(1)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(attempts.length / PAGE_SIZE)))
  const visibleAttempts = attempts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-sm font-semibold text-charcoal">
            Oral Reading Submissions
          </h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="font-sans text-xs font-medium text-charcoal hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="font-sans text-sm text-gray-400">Loading submissions…</p>
      ) : attempts.length === 0 ? (
        <p className="font-sans text-sm text-gray-400">
          No oral reading submissions yet. They appear here once the learner completes a reading.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleAttempts.map((a) => (
            <AttemptCard key={a.id} attempt={a} />
          ))}
        </div>
      )}
      {!loading && attempts.length > 0 && (
        <Pagination total={attempts.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </section>
  )
}
