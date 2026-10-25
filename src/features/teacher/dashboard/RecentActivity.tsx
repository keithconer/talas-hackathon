import { useNavigate } from 'react-router-dom'
import { ArrowRight, Image, Mic } from 'lucide-react'
import { useSubmissions } from './useSubmissions'
import { LEARNERS } from './sectionData'
import type { ReadingAttempt } from '../../../data'

function learnerName(id: string): string {
  return LEARNERS.find((l) => l.id === id)?.name ?? id
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toneForAccuracy(pct: number): string {
  if (pct >= 80) return 'bg-sprout-50 text-sprout-500'
  if (pct >= 60) return 'bg-sky-50 text-sky-500'
  return 'bg-coral-50 text-coral-500'
}

/**
 * Recent learner submissions — the latest oral reading attempts across all
 * learners, plus a separate list of Salita at Larawan submissions so their
 * grades stay visually and logically distinct from Oral & Silent reading.
 */
function RecentActivity() {
  const navigate = useNavigate()
  const { byLearner, pictureAttempts, refresh } = useSubmissions()

  // Flatten every learner's oral reading attempts, newest first, take the latest few.
  const feed: ReadingAttempt[] = Object.values(byLearner)
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)

  const recentPictures = pictureAttempts.slice(0, 5)

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold text-charcoal">Recent Submissions</h2>
        <button
          type="button"
          onClick={refresh}
          className="font-sans text-xs font-semibold text-sprout-500 hover:underline"
        >
          Refresh
        </button>
      </div>

      {feed.length === 0 && recentPictures.length === 0 ? (
        <div className="py-8 text-center">
          <p className="font-sans text-sm text-gray-500">No submissions yet.</p>
          <p className="font-sans text-xs text-gray-400 mt-1">
            Learner submissions will appear here once they complete their work.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.length > 0 && (
            <div className="space-y-2">
              <span className="font-sans text-xs font-bold uppercase tracking-wide text-gray-400">
                Oral Reading
              </span>
              <ol className="flex flex-col gap-2">
                {feed.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/teacher/activities/${a.id}/review`)}
                      title={`Review ${learnerName(a.learnerId)}'s reading`}
                      className="group w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-gray-100 hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className="w-8 h-8 rounded-md bg-gray-100 text-charcoal flex items-center justify-center shrink-0">
                        <Mic className="w-4 h-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-charcoal">
                            Oral Reading
                          </span>
                          <span className="font-sans text-xs text-gray-400 shrink-0">
                            {fmtTime(a.createdAt)}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-charcoal leading-snug mt-0.5">
                          <span className="font-semibold group-hover:text-sprout-500 transition-colors">
                            {learnerName(a.learnerId)}
                          </span>
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md font-sans text-[11px] font-medium mt-1 ${toneForAccuracy(a.accuracy)}`}
                        >
                          {a.accuracy}% · {a.correctWords}/{a.totalWords}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {recentPictures.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-xs font-semibold uppercase tracking-wide text-charcoal">
                  Salita at Larawan
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-sans text-[10px] font-bold">
                  Separate Grade
                </span>
              </div>
              <ol className="flex flex-col gap-2">
                {recentPictures.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/teacher/learners/${p.learnerId}/activities`)}
                      title={`View ${learnerName(p.learnerId)}'s Salita at Larawan result`}
                      className="group w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-gray-100 hover:bg-gray-50 text-left transition-colors"
                    >
                      <span className="w-8 h-8 rounded-md bg-gray-100 text-charcoal flex items-center justify-center shrink-0">
                        <Image className="w-4 h-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-charcoal">
                            Salita at Larawan
                          </span>
                          <span className="font-sans text-xs text-gray-400 shrink-0">
                            {fmtTime(p.createdAt)}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-charcoal leading-snug mt-0.5">
                          <span className="font-semibold group-hover:text-sprout-500 transition-colors">
                            {learnerName(p.learnerId)}
                          </span>
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-sans text-[11px] font-medium mt-1 bg-white text-charcoal border border-gray-200">
                          {p.scorePercent}% · {p.correctAnswers}/{p.totalQuestions} tama
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/teacher/activities')}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-paper hover:bg-gray-50 border border-gray-100 text-charcoal font-sans text-sm font-semibold transition-colors group"
      >
        <span>View all assessment logs</span>
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
    </section>
  )
}

export default RecentActivity
