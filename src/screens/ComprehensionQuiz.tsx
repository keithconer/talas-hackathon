import { useState } from 'react'
import { mockQuiz } from '../data/mockData'

interface Props {
  onComplete: (score: number) => void
}

export default function ComprehensionQuiz({ onComplete }: Props) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null)
  const [score, setScore] = useState<number>(0)

  const currentQuestion = mockQuiz[currentIndex]
  const total = mockQuiz.length
  const progressPercent = ((currentIndex + 1) / total) * 100

  const handleNext = () => {
    if (selectedChoice === null) return

    const isCorrect = selectedChoice === currentQuestion.correctIndex
    const newScore = score + (isCorrect ? 1 : 0)

    if (currentIndex < total - 1) {
      setScore(newScore)
      setCurrentIndex(currentIndex + 1)
      setSelectedChoice(null)
    } else {
      onComplete(newScore)
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        background: 'var(--talas-paper)',
        minHeight: '100svh',
      }}
    >
      {/* Progress indicator */}
      <div style={{ marginBottom: '16px' }}>
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '14px',
            color: 'var(--talas-charcoal)',
            textAlign: 'center',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontWeight: 600,
          }}
        >
          Tanong {currentIndex + 1} ng {total}
        </p>
        <div
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: 'var(--talas-line)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--talas-green)',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Question */}
      <p
        className="font-quicksand"
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--talas-charcoal)',
          marginBottom: '20px',
          marginTop: '8px',
          lineHeight: 1.5,
        }}
      >
        {currentQuestion.question}
      </p>

      {/* Choices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
        {currentQuestion.choices.map((choice, index) => {
          const isSelected = selectedChoice === index
          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedChoice(index)}
              style={{
                width: '100%',
                minHeight: '56px',
                border: isSelected ? '2px solid var(--talas-green)' : '2px solid var(--talas-line)',
                borderRadius: '14px',
                background: isSelected ? 'var(--talas-blue-soft)' : 'white',
                textAlign: 'left',
                padding: '12px 16px',
                fontSize: '17px',
                fontFamily: "'Inter', system-ui, sans-serif",
                color: 'var(--talas-charcoal)',
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Next button */}
      <div style={{ paddingTop: '20px' }}>
        <button
          type="button"
          onClick={handleNext}
          disabled={selectedChoice === null}
          style={{
            width: '100%',
            minHeight: '56px',
            background: 'var(--talas-green)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '20px',
            fontWeight: 700,
            fontFamily: "'Inter', system-ui, sans-serif",
            cursor: selectedChoice === null ? 'not-allowed' : 'pointer',
            opacity: selectedChoice === null ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          Susunod
        </button>
      </div>
    </div>
  )
}
