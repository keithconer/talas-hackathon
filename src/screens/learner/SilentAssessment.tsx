import { useState, useEffect, useRef } from 'react'
import { Check, X, type LucideIcon } from 'lucide-react'
import { mockQuiz, mockPassage } from '../../data/mockData'
import type { QuizQuestion } from '../../data/mockData'
import { save, syncNow, type SilentQuestionResponse } from '../../data'

const SILENT_ASSESSMENT_ID = 'silent-ang-batang-magsasaka-v1'
const SILENT_TITLE = 'Ang Batang Magsasaka'

export interface SilentResult {
  correctAnswers: number
  totalQuestions: number
  scorePercent: number
  durationSec: number
}

interface Props {
  learnerId: string
  onComplete: (result: SilentResult) => void
}

function formatTime(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function SilentAssessment({ learnerId, onComplete }: Props) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState<boolean>(false)
  const [questionSeconds, setQuestionSeconds] = useState<number>(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [responses, setResponses] = useState<SilentQuestionResponse[]>([])
  // Hard locks prevent duplicate answer registration and duplicate submission.
  const lockedRef = useRef<boolean>(false)
  const submittedRef = useRef(false)

  const questions: QuizQuestion[] = mockQuiz
  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  // Question timer. The per-question reset to 0 is handled in handleNext (and
  // the initial state is 0), so the effect only needs to run the interval —
  // avoiding a synchronous setState in the effect body.
  useEffect(() => {
    const id = setInterval(() => {
      setQuestionSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [currentQuestionIndex])

  const handleSelect = (idx: number) => {
    // Reject if already answered OR a selection is already locked in this tick.
    if (hasAnswered || lockedRef.current) return
    lockedRef.current = true
    const correct = idx === currentQuestion.correctIndex
    setSelectedIndex(idx)
    setHasAnswered(true)
    if (correct) setCorrectCount((count) => count + 1)
    setResponses((current) => [
      ...current,
      {
        questionId: `${SILENT_ASSESSMENT_ID}-q${currentQuestionIndex + 1}`,
        selectedIndex: idx,
        correct,
        durationSec: questionSeconds,
      },
    ])
  }

  const handleNext = async () => {
    if (isLastQuestion) {
      if (submittedRef.current) return
      submittedRef.current = true

      const totalQuestions = questions.length
      const scorePercent = totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 100)
        : 0
      const durationSec = responses.reduce((total, response) => total + response.durationSec, 0)
      const result: SilentResult = {
        correctAnswers: correctCount,
        totalQuestions,
        scorePercent,
        durationSec,
      }

      try {
        await save('silentAttempts', {
          id: `silent-attempt-${SILENT_ASSESSMENT_ID}-${Date.now()}`,
          learnerId,
          assessmentId: SILENT_ASSESSMENT_ID,
          title: SILENT_TITLE,
          correctAnswers: correctCount,
          totalQuestions,
          scorePercent,
          responses,
          durationSec,
          online: navigator.onLine,
          createdAt: new Date().toISOString(),
        })
        // Best effort: offline records remain dirty and sync on reconnect.
        void syncNow()
      } catch (error) {
        console.error('[TALAS] Failed to save silent assessment:', error)
      }

      onComplete(result)
      return
    }
    // Move strictly forward, one question at a time, and unlock for the next.
    lockedRef.current = false
    setCurrentQuestionIndex((prev) => prev + 1)
    setSelectedIndex(null)
    setHasAnswered(false)
    setQuestionSeconds(0)
  }

  const wordCount = mockPassage.join(' ').trim().split(/\s+/).filter(Boolean).length

  const progressFill =
    ((currentQuestionIndex + (hasAnswered ? 1 : 0)) / questions.length) * 100

  if (!currentQuestion) return null

  const choiceLabels = ['A', 'B', 'C', 'D']

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        minHeight: '100svh',
        background: 'var(--talas-paper)',
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          background: 'white',
          borderBottom: '1px solid var(--talas-blue-soft)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--talas-green)',
            whiteSpace: 'nowrap',
          }}
        >
          PAGSUSURI
        </span>
        <div
          style={{
            flex: 1,
            height: '6px',
            background: 'var(--talas-line)',
            borderRadius: '3px',
          }}
        >
          <div
            style={{
              width: `${progressFill}%`,
              height: '100%',
              background: 'var(--talas-green)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: 'var(--talas-muted)',
            }}
          >
            Tanong {currentQuestionIndex + 1} ng {questions.length}
          </span>
        </div>
      </div>

      {/* MAIN CONTENT — two-column with flex wrap */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* LEFT PANEL — passage */}
        <div style={{ flex: '1 1 340px', minWidth: '280px' }}>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--talas-green)',
              marginBottom: '8px',
            }}
          >
            TALAS – Tahimik na Pagbasa
          </div>

          {/* Story title */}
          <div
            style={{
              fontFamily: "'Fredoka', system-ui, sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
              marginTop: '12px',
            }}
          >
            Ang Batang Magsasaka
          </div>

          {/* Passage paragraphs */}
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '16px',
              lineHeight: 1.8,
              color: 'var(--talas-charcoal)',
              marginTop: '8px',
            }}
          >
            {mockPassage[0]}
          </p>
          {mockPassage[1] && (
            <p
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '16px',
                lineHeight: 1.8,
                color: 'var(--talas-charcoal)',
                marginTop: '8px',
              }}
            >
              {mockPassage[1]}
            </p>
          )}

          {/* Word count badge */}
          <div
            style={{
              display: 'inline-block',
              background: 'var(--talas-sky)',
              color: 'var(--talas-blue)',
              borderRadius: '14px',
              padding: '4px 10px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '11px',
              marginTop: '8px',
            }}
          >
            {wordCount} salita
          </div>
        </div>

        {/* RIGHT PANEL — question */}
        <div style={{ flex: '1 1 320px', minWidth: '280px' }}>
          {/* Question type badge */}
          <div
            style={{
              display: 'inline-block',
              background: 'var(--talas-buttercream)',
              color: 'var(--talas-yellow-dark)',
              borderRadius: '14px',
              padding: '4px 12px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '8px',
            }}
          >
            LITERAL NA TANONG
          </div>

          {/* Question text */}
          <div
            style={{
              fontFamily: "'Fredoka', system-ui, sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
              marginBottom: '20px',
            }}
          >
            {currentQuestion.question}
          </div>

          {/* Choices */}
          {currentQuestion.choices.map((choice, i) => {
            let bg = 'white'
            let borderColor = 'var(--talas-line)'
            let labelColor = 'var(--talas-charcoal)'
            let Icon: LucideIcon | null = null

            if (hasAnswered) {
              if (i === currentQuestion.correctIndex) {
                bg = 'var(--talas-blue-soft)'
                borderColor = 'var(--talas-green)'
                labelColor = 'var(--talas-green)'
                Icon = Check
              } else if (i === selectedIndex) {
                bg = 'var(--talas-red-soft)'
                borderColor = 'var(--talas-coral)'
                labelColor = 'var(--talas-coral)'
                Icon = X
              }
            }

            // Dim the choices the student did NOT pick once locked, so it's
            // visually clear the answer is final and can't be changed.
            const dim = hasAnswered && i !== selectedIndex && i !== currentQuestion.correctIndex

            return (
              <button
                key={i}
                type="button"
                disabled={hasAnswered}
                onClick={() => handleSelect(i)}
                style={{
                  width: '100%',
                  minHeight: '56px',
                  borderRadius: '14px',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '15px',
                  cursor: hasAnswered ? 'default' : 'pointer',
                  textAlign: 'left',
                  marginBottom: '8px',
                  transition: 'background 0.2s, border-color 0.2s, opacity 0.2s',
                  background: bg,
                  border: `2px solid ${borderColor}`,
                  opacity: dim ? 0.5 : 1,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '14px',
                    fontWeight: 700,
                    color: labelColor,
                    minWidth: '20px',
                  }}
                >
                  {Icon ? <Icon size={17} aria-label={Icon === Check ? 'Tama' : 'Maling sagot'} /> : choiceLabels[i]}
                </span>
                <span style={{ color: 'var(--talas-charcoal)' }}>{choice}</span>
              </button>
            )
          })}

          {/* Explanation */}
          {hasAnswered && (
            <div
              style={{
                marginTop: '12px',
                background: 'var(--talas-sky)',
                borderRadius: '12px',
                padding: '12px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '14px',
                color: 'var(--talas-blue-dark)',
              }}
            >
               {currentQuestion.explanation}
            </div>
          )}

          {/* Progress text */}
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: 'var(--talas-muted)',
              marginTop: '16px',
            }}
          >
            Tanong {currentQuestionIndex + 1} ng {questions.length}
          </div>

          {/* Timer */}
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: 'var(--talas-muted)',
              textAlign: 'right',
            }}
          >
            Oras sa Pahina: {formatTime(questionSeconds)}
          </div>

          {/* Next / Submit button */}
          <button
            type="button"
            disabled={!hasAnswered}
            onClick={() => void handleNext()}
            style={{
              marginTop: '16px',
              width: '100%',
              minHeight: '56px',
              background: hasAnswered ? 'var(--talas-green)' : 'var(--talas-blue-soft)',
              color: hasAnswered ? 'white' : 'var(--talas-muted)',
              border: 'none',
              borderRadius: '16px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '16px',
              fontWeight: 600,
              cursor: hasAnswered ? 'pointer' : 'not-allowed',
            }}
          >
            {isLastQuestion ? 'Isumite ang Pagsusuri →' : 'Susunod →'}
          </button>
        </div>
      </div>
    </div>
  )
}
