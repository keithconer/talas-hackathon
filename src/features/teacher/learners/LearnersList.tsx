import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { crlaLabel, learnersForSection } from '../dashboard/sectionData'
import SectionSelector from '../dashboard/SectionSelector'
import Pagination from '../shared/Pagination'

const PAGE_SIZE = 10

/** Teacher learner directory. Rows link to the learner profile. */
function LearnersList() {
  const navigate = useNavigate()
  const [sectionId, setSectionId] = useState('all')
  const [page, setPage] = useState(1)

  const learners = learnersForSection(sectionId)
  const pageCount = Math.max(1, Math.ceil(learners.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleLearners = learners.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => setPage(1), [sectionId])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-bold text-charcoal tracking-tight">Learners</h1>
          <p className="font-sans text-xs text-gray-500">
            All learners across your Grade 1–3 classes.
          </p>
        </div>
        <SectionSelector value={sectionId} onChange={setSectionId} />
      </header>

      {learners.length === 0 ? (
        <p className="font-sans text-sm text-gray-500 py-8 text-center">
          No learners in this section yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visibleLearners.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate(`/teacher/learners/${l.id}`)}
              className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-200 text-left hover:bg-gray-50 transition-colors"
            >
              <span className="w-9 h-9 rounded-md bg-gray-100 text-charcoal flex items-center justify-center font-sans text-xs font-semibold shrink-0">
                {l.initials}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="font-sans text-[13px] font-medium text-charcoal truncate">{l.name}</span>
                <span className="font-sans text-xs text-gray-500">
                  {l.grade} • {crlaLabel(l.level)}
                </span>
              </span>
              <span className="ml-auto font-sans text-xs text-gray-400 shrink-0">{l.id}</span>
            </button>
          ))}
        </div>
      )}
      <Pagination total={learners.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setPage} />
    </div>
  )
}

export default LearnersList
