import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { learnersForSection, isLearnerActive, type CrlaLevel } from './sectionData'
import { useSubmissions } from './useSubmissions'
import { profileFromAccuracy } from '../../../reading/crla'
import type { ReadingAttempt } from '../../../data'
import Pagination from '../shared/Pagination'

const PAGE_SIZE = 8

interface LearnerListTableProps {
  sectionId?: string
}

/**
 * Derives a CRLA level from a learner's submissions using the CRLA standard
 * (see reading/crla.ts). Based strictly on the learner's best oral-reading
 * accuracy — Salita at Larawan scores are never included here.
 */
function levelFromAttempts(attempts: ReadingAttempt[]): CrlaLevel {
  if (attempts.length === 0) return null
  const best = Math.max(...attempts.map((a) => a.accuracy))
  return profileFromAccuracy(best)
}

/** Relative "x min/hour/day ago" from an ISO timestamp. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

/** The most recent timestamp across timestamps, or null. */
function latestTimestamp(timestamps: string[]): string | null {
  if (timestamps.length === 0) return null
  return timestamps.reduce((max, t) => (t > max ? t : max), timestamps[0])
}

const LEVEL_META: Record<Exclude<CrlaLevel, null>, { label: string; cls: string }> = {
  GR: { label: 'Grade Ready', cls: 'bg-crla-gr/15 text-crla-gr' },
  LR: { label: 'Light Refresher', cls: 'bg-crla-lr/20 text-charcoal' },
  MR: { label: 'Moderate Refresher', cls: 'bg-crla-mr/15 text-crla-mr' },
  FR: { label: 'Full Refresher', cls: 'bg-crla-fr/15 text-crla-fr' },
}

function LevelBadge({ level }: { level: CrlaLevel }) {
  if (!level) {
    return (
      <span className="inline-flex px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 font-sans text-xs font-semibold">
        Not assessed
      </span>
    )
  }
  const meta = LEVEL_META[level]
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full font-sans text-xs font-bold ${meta.cls}`}>
      {level} · {meta.label}
    </span>
  )
}

function LearnerListTable({ sectionId = 'all' }: LearnerListTableProps) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const learners = learnersForSection(sectionId)
  const { byLearner, pictureByLearner } = useSubmissions()
  const pageCount = Math.max(1, Math.ceil(learners.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleLearners = learners.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => setPage(1), [sectionId])

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-charcoal">Learners</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-sprout-50 text-sprout-500 font-sans text-xs font-semibold">
            {learners.length} learners
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/teacher/learners')}
          className="font-sans text-sm font-semibold text-sprout-500 hover:underline"
        >
          View all
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-y border-gray-100 bg-paper">
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Learner</th>
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reading Level</th>
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Salita at Larawan</th>
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Submissions</th>
              <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Last Active</th>
            </tr>
          </thead>
          <tbody>
            {learners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center font-sans text-sm text-gray-400">
                  No learners in this section.
                </td>
              </tr>
            ) : (
              visibleLearners.map((l) => {
                const attempts = byLearner[l.id] ?? []
                const pictureAttempts = pictureByLearner[l.id] ?? []
                const latestPicture = pictureAttempts[0]
                const pictureAvg =
                  pictureAttempts.length > 0
                    ? Math.round(
                        pictureAttempts.reduce((sum, a) => sum + a.scorePercent, 0) /
                          pictureAttempts.length,
                      )
                    : null
                // Latest oral attempt first — the "to review" badge opens it directly.
                const sorted = [...attempts].sort((a, b) =>
                  a.createdAt < b.createdAt ? 1 : -1,
                )
                const latest = sorted[0]
                // CRLA Reading Level comes strictly from oral reading attempts.
                const level = levelFromAttempts(attempts)
                const lastTime = latestTimestamp([
                  ...attempts.map((a) => a.createdAt),
                  ...pictureAttempts.map((a) => a.createdAt),
                ])
                return (
                  <tr
                    key={l.id}
                    onClick={() => navigate(`/teacher/learners/${l.id}`)}
                    className="border-b border-gray-50 last:border-0 hover:bg-paper cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-md bg-gray-100 text-charcoal flex items-center justify-center font-sans text-xs font-semibold">
                          {l.initials}
                        </span>
                        <span className="font-sans text-[13px] font-medium text-charcoal">{l.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-sans text-[13px] text-gray-600">{l.grade}</td>
                    <td className="px-4 py-2.5"><LevelBadge level={level} /></td>
                    <td className="px-4 py-2.5">
                      {latestPicture && pictureAvg != null ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/teacher/learners/${l.id}/activities`)
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 bg-white font-sans text-xs font-medium text-charcoal hover:bg-gray-50 transition-colors"
                          title="Separate grade for Salita at Larawan (not included in Oral/Silent reading)"
                        >
                          {pictureAvg}% ({latestPicture.correctAnswers}/{latestPicture.totalQuestions})
                        </button>
                      ) : (
                        <span className="font-sans text-[13px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {latest ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/teacher/activities/${latest.id}/review`)
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 bg-white font-sans text-xs font-medium text-charcoal hover:bg-gray-50 transition-colors"
                        >
                          {attempts.length} to review
                        </button>
                      ) : (
                        <span className="font-sans text-[13px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isLearnerActive(l.id) ? (
                        <span className="inline-flex items-center gap-1.5 font-sans text-[13px] font-medium text-charcoal">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          Now
                        </span>
                      ) : (
                        <span className="font-sans text-[13px] text-gray-400">
                          {lastTime ? timeAgo(lastTime) : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination total={learners.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </section>
  )
}

export default LearnerListTable
