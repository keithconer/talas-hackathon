import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/** Assign a new assessment to a specific learner. */
function AssignAssessment() {
  const navigate = useNavigate()
  const { learnerId } = useParams()

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate('/teacher/assessments')}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-sans text-sm text-charcoal transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back to Assessments
      </button>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold text-charcoal">Assign Assessment</h1>
        <p className="font-sans text-sm text-gray-500">Create a new assessment for learner {learnerId}.</p>
      </header>
      <div className="bg-white rounded-2xl border border-gray-200 p-6 font-reading text-gray-500">
        Assessment assignment form to be added.
      </div>
    </div>
  )
}

export default AssignAssessment
