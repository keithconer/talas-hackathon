import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, GraduationCap, Lock } from 'lucide-react'
import { TEACHER_PIN_LENGTH, verifyTeacherPin } from './teacherSession'

interface Props {
  /** Called once the correct PIN is entered. */
  onSuccess: () => void
}

/**
 * Teacher access gate. The teacher dashboard cannot be reached until the
 * correct PIN is entered. Renders a segmented numeric PIN field; a wrong PIN
 * is rejected and cleared, a correct one unlocks the teacher area.
 */
export default function TeacherAuth({ onSuccess }: Props) {
  const navigate = useNavigate()
  const [digits, setDigits] = useState<string[]>(
    () => Array(TEACHER_PIN_LENGTH).fill(''),
  )
  const [error, setError] = useState<string | null>(null)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const focusAt = (i: number) => inputsRef.current[i]?.focus()

  const submit = (pin: string) => {
    if (verifyTeacherPin(pin)) {
      setError(null)
      onSuccess()
    } else {
      setError('Incorrect PIN. Please try again.')
      setDigits(Array(TEACHER_PIN_LENGTH).fill(''))
      focusAt(0)
    }
  }

  const handleChange = (index: number, raw: string) => {
    // Keep only digits; support paste of the whole PIN into one box.
    const cleaned = raw.replace(/\D/g, '')
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev]
        next[index] = ''
        return next
      })
      return
    }

    if (error) setError(null)

    setDigits((prev) => {
      const next = [...prev]
      let cursor = index
      for (const ch of cleaned) {
        if (cursor >= TEACHER_PIN_LENGTH) break
        next[cursor] = ch
        cursor++
      }
      const landing = Math.min(cursor, TEACHER_PIN_LENGTH - 1)
      focusAt(landing)

      const joined = next.join('')
      if (joined.length === TEACHER_PIN_LENGTH && !joined.includes('')) {
        // Defer so the final digit paints before we validate.
        queueMicrotask(() => submit(joined))
      }
      return next
    })
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault()
      focusAt(index - 1)
      setDigits((prev) => {
        const next = [...prev]
        next[index - 1] = ''
        return next
      })
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1)
    } else if (e.key === 'ArrowRight' && index < TEACHER_PIN_LENGTH - 1) {
      focusAt(index + 1)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    submit(digits.join(''))
  }

  const complete = digits.every((d) => d !== '')

  return (
    <main className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 py-16">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 font-sans text-sm text-charcoal transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden /> Back
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col items-center gap-5">
        <span className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sprout-50 text-sprout-500">
          <GraduationCap className="w-8 h-8" aria-hidden />
          <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sprout-500 text-white flex items-center justify-center shadow-sm">
            <Lock className="w-3.5 h-3.5" aria-hidden />
          </span>
        </span>

        <div className="text-center space-y-1">
          <h1 className="font-display text-2xl font-bold text-charcoal">Teacher Access</h1>
          <p className="font-reading text-sm text-gray-500">
            Enter your {TEACHER_PIN_LENGTH}-digit PIN to open the dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <div
            className="flex items-center justify-center gap-3"
            role="group"
            aria-label={`${TEACHER_PIN_LENGTH}-digit teacher PIN`}
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el
                }}
                type="password"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={TEACHER_PIN_LENGTH}
                value={digit}
                autoFocus={i === 0}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                aria-label={`PIN digit ${i + 1}`}
                className={`w-14 h-16 text-center font-sans text-2xl font-bold rounded-xl border outline-none transition-colors ${
                  error
                    ? 'border-coral-500 focus:border-coral-500'
                    : 'border-gray-200 focus:border-sprout-500 focus:ring-2 focus:ring-sprout-500/30'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="font-sans text-sm text-coral-500 text-center" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!complete}
            className="w-full min-h-13 rounded-xl bg-sprout-500 text-white font-sans text-base font-bold transition-colors hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unlock dashboard
          </button>
        </form>

        <p className="font-sans text-xs text-gray-400 text-center">
          Demo PIN: 1234
        </p>
      </div>
    </main>
  )
}
