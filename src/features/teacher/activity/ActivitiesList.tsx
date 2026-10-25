import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubmissions } from '../dashboard/useSubmissions'
import { LEARNERS } from '../dashboard/sectionData'
import type { ReadingAttempt } from '../../../data'
import Pagination from '../shared/Pagination'

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
 * Oral reading submissions and Salita at Larawan submissions are listed in
 * separate sections so their grades are never combined.
 */
function ActivitiesList() {
  const navigate = useNavigate()
  const [oralPage, setOralPage] = useState(1)
  const [picturePage, setPicturePage] = useState(1)
  const { byLearner, pictureAttempts } = useSubmissions()

  const activities: ReadingAttempt[] = Object.values(byLearner)
    .flat()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const oralPageCount = Math.max(1, Math.ceil(activities.length / PAGE_SIZE))
  const currentOralPage = Math.min(oralPage, oralPageCount)
  const currentPicturePage = Math.min(picturePage, Math.max(1, Math.ceil(pictureAttempts.length / PAGE_SIZE)))
  const visibleActivities = activities.slice((currentOralPage - 1) * PAGE_SIZE, currentOralPage * PAGE_SIZE)
  const visiblePictureAttempts = pictureAttempts.slice((currentPicturePage - 1) * PAGE_SIZE, currentPicturePage * PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-charcoal">Activities</h1>
        <p className="text-xs text-gray-500">
          Recent learner activity submissions. Salita at Larawan results are kept separate from Oral & Silent reading grades.
        </p>
      </header>

      <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white">
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
                  <span className="text-[13px] font-medium truncate">Oral Reading</span>
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

      <section className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-charcoal">Salita at Larawan Submissions</h2>
            <span className="text-xs text-gray-500">
              Separate Grade
            </span>
          </div>
          <span className="text-xs font-semibold text-gray-500">
            {pictureAttempts.length} submission{pictureAttempts.length === 1 ? '' : 's'}
          </span>
        </div>

        {pictureAttempts.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">No Salita at Larawan submissions yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1 px-3">
            {visiblePictureAttempts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/teacher/learners/${p.learnerId}/activities`)}
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="flex flex-col min-w-0">
                  <span className="text-[13px] font-medium truncate">{p.title}</span>
                  <span className="text-xs text-gray-500">
                    {learnerName(p.learnerId)} • {fmtTime(p.createdAt)} • {p.correctAnswers}/{p.totalQuestions} tama
                  </span>
                </span>
                <span className="ml-auto px-2 py-0.5 rounded-md border border-gray-200 text-xs font-medium text-gray-600 shrink-0">
                  {p.scorePercent}% (Hiwalay)
                </span>
              </button>
            ))}
          </div>
        )}
        <Pagination total={pictureAttempts.length} page={currentPicturePage} pageSize={PAGE_SIZE} onPageChange={setPicturePage} />
      </section>
    </div>
  )
}

export default ActivitiesList
