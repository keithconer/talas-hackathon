import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubmissions } from '../dashboard/useSubmissions'
import { LEARNERS } from '../dashboard/sectionData'
import type { ReadingAttempt } from '../../../data'
import Pagination from '../shared/Pagination'
import { getActivity } from '../../../data/contentBank'

const PAGE_SIZE = 8

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

/**
 * Submitted learner activities from the real data layer.
 * Oral and silent reading submissions are shown in their own review sections.
 */
function ActivitiesList() {
  const navigate = useNavigate()
  const [oralPage, setOralPage] = useState(1)
  const [silentPage, setSilentPage] = useState(1)
  const { byLearner, silentAttempts } = useSubmissions()

  const activities: ReadingAttempt[] = Object.values(byLearner)
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const oralPageCount = Math.max(1, Math.ceil(activities.length / PAGE_SIZE))
  const currentOralPage = Math.min(oralPage, oralPageCount)
  const visibleActivities = activities.slice((currentOralPage - 1) * PAGE_SIZE, currentOralPage * PAGE_SIZE)
  const silentPageCount = Math.max(1, Math.ceil(silentAttempts.length / PAGE_SIZE))
  const currentSilentPage = Math.min(silentPage, silentPageCount)
  const visibleSilentAttempts = silentAttempts.slice((currentSilentPage - 1) * PAGE_SIZE, currentSilentPage * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-charcoal">Activities</h1>
        <p className="text-xs text-gray-500">
          Recent oral and silent reading submissions from your learners.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-charcoal">Oral Reading Submissions</h2>
          <span className="text-xs font-semibold text-gray-500">
            {activities.length} submission{activities.length === 1 ? '' : 's'}
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">No oral reading submissions yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-3">
            {visibleActivities.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/teacher/activities/${a.id}/review`)}
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium truncate">{getActivity(a.passageId)?.title ?? 'Pasalitang Pagbasa'}</span>
                  <span className="text-xs text-gray-500">
                    {learnerName(a.learnerId)} • {fmtTime(a.createdAt)} • {a.accuracy}%
                  </span>
                </span>
                <span className="ml-auto px-2 py-0.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 shrink-0">
                  Needs Review
                </span>
              </button>
            ))}
          </div>
        )}
        <Pagination total={activities.length} page={currentOralPage} pageSize={PAGE_SIZE} onPageChange={setOralPage} />
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-charcoal">Silent Reading Submissions</h2>
          <span className="text-xs font-semibold text-gray-500">{silentAttempts.length} submission{silentAttempts.length === 1 ? '' : 's'}</span>
        </div>
        {silentAttempts.length === 0 ? (
          <div className="p-6 text-center"><p className="text-gray-500">No silent reading submissions yet.</p></div>
        ) : (
          <div className="flex flex-col gap-1 px-3">
            {visibleSilentAttempts.map((attempt) => (
              <button key={attempt.id} type="button" onClick={() => navigate(`/teacher/learners/${attempt.learnerId}/activities`)} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors">
                <span className="flex flex-col min-w-0"><span className="text-[13px] font-medium truncate">{attempt.title}</span><span className="text-xs text-gray-500">{learnerName(attempt.learnerId)} • {fmtTime(attempt.createdAt)} • {attempt.correctAnswers}/{attempt.totalQuestions}</span></span>
                <span className="ml-auto px-2 py-0.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 shrink-0">{attempt.scorePercent}%</span>
              </button>
            ))}
          </div>
        )}
        <Pagination total={silentAttempts.length} page={currentSilentPage} pageSize={PAGE_SIZE} onPageChange={setSilentPage} />
      </section>


    </div>
  )
}

export default ActivitiesList
