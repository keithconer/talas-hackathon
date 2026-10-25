import { useNavigate } from 'react-router-dom'

interface Recommendation {
  id: string
  learnerId: string
  learner: string
  detail: string
}

const PENDING: Recommendation[] = []

/** System-generated recommendations awaiting a teacher decision. */
function PendingRecommendations() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
        <p className="text-gray-500">
          Pending recommendations generated from recent practice and assessments.
        </p>
      </header>

      {PENDING.length === 0 ? (
        <div className="p-8 rounded-xl bg-white shadow-sm text-center">
          <p className="text-gray-500">No pending recommendations.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {PENDING.map((r) => (
            <article
              key={r.id}
              className="p-5 rounded-xl bg-white shadow-sm flex flex-col gap-3"
            >
              <button
                type="button"
                onClick={() => navigate(`/teacher/learners/${r.learnerId}/recommendations`)}
                className="font-bold text-left hover:text-primary transition-colors w-fit"
              >
                {r.learner}
              </button>
              <p className="text-gray-500">{r.detail}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg bg-primary-container hover:bg-primary text-on-primary text-sm font-semibold transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg bg-gray-50 hover:bg-gray-100 text-charcoal text-sm font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default PendingRecommendations
