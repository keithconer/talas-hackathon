import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ArrowLeft } from 'lucide-react'
import {
  findLearnerByCode,
  setLearnerActive,
  type LearnerRecord,
} from '../teacher/dashboard/sectionData'

interface Props {
  /** Called with the matched learner once a valid code is entered. */
  onSuccess: (learner: LearnerRecord) => void
}

/**
 * Learner access gate. A learner can only enter with a valid per-student code
 * (distributed by their teacher). An invalid code is rejected; a valid code
 * identifies the exact student, marks them active ("Now") on the teacher
 * roster, and hands the record to the learner flow.
 */
export default function LearnerAuth({ onSuccess }: Props) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const learner = findLearnerByCode(code)
    if (!learner) {
      setError('Mali ang code. Pakisubukan muli.')
      return
    }
    setError(null)
    setLearnerActive(learner.id)
    onSuccess(learner)
  }

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 py-16">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-sans text-sm text-charcoal transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Bumalik
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center gap-5">
        <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sky-50 text-sky-500">
          <BookOpen className="w-8 h-8" aria-hidden />
        </span>
        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-bold text-charcoal">
            Ilagay ang iyong code
          </h1>
          <p className="font-reading text-sm text-gray-500">
            Ibinigay ito ng iyong guro para makapasok.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              if (error) setError(null)
            }}
            placeholder="HAL. BEA123"
            aria-label="Learner access code"
            className={`w-full text-center tracking-[0.3em] uppercase font-sans text-xl font-bold rounded-xl border px-4 py-4 outline-none transition-colors ${
              error
                ? 'border-coral-500 focus:border-coral-500'
                : 'border-gray-200 focus:border-sky-500'
            }`}
          />

          {error && (
            <p className="font-sans text-sm text-coral-500 text-center" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.trim().length === 0}
            className="w-full min-h-13 rounded-xl bg-sky-500 text-white font-sans text-base font-bold transition-colors hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Pumasok →
          </button>
        </form>
      </div>
    </main>
  )
}
