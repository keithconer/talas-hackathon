import { useState } from 'react'
import { ArrowLeft, Check, X, type LucideIcon } from 'lucide-react'
import { vocabularyItems } from '../../../data/practiceData'

interface Props {
  onComplete: (scorePercent: number) => void
  onBack: () => void
}

function TopBar({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        background: 'white',
        borderBottom: '1px solid var(--talas-blue-soft)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'sticky',
        top: 0,
        zIndex: 5,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          minHeight: '48px',
          minWidth: '48px',
          background: 'transparent',
          border: 'none',
          color: 'var(--talas-blue)',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '14px',
          cursor: 'pointer',
          padding: '0 8px',
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div
        style={{
          flex: 1,
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--talas-charcoal)',
        }}
      >
         Hanapin ang Salita
      </div>
      <span
        style={{
          background: 'var(--talas-sky)',
          color: 'var(--talas-blue)',
          borderRadius: '10px',
          padding: '4px 10px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        Bokabularyo
      </span>
    </div>
  )
}

export default function VocabularyActivity({ onComplete, onBack }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  const item = vocabularyItems[index]
  const isLast = index === vocabularyItems.length - 1
  const choiceLabels = ['A', 'B', 'C', 'D']

  const handleSelect = (i: number) => {
    if (answered) return
    setSelected(i)
    setAnswered(true)
    if (i === item.correctIndex) setCorrectCount((c) => c + 1)
  }

  const handleNext = () => {
    if (isLast) { onComplete(Math.round((correctCount / vocabularyItems.length) * 100)); return }
    setIndex((v) => v + 1)
    setSelected(null)
    setAnswered(false)
  }

  return (
    <div style={{ width: 'min(640px, 100%)', margin: '0 auto', minHeight: '100svh', background: 'var(--talas-paper)' }}>
      <TopBar onBack={onBack} />
      <div style={{ padding: 'clamp(12px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Progress */}
        <div>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: 'var(--talas-muted)',
              textAlign: 'center',
              marginBottom: '8px',
            }}
          >
            Salita {index + 1} ng {vocabularyItems.length}
          </div>
          <div style={{ height: '6px', background: 'var(--talas-line)', borderRadius: '3px' }}>
            <div
              style={{
                width: `${((index + (answered ? 1 : 0)) / vocabularyItems.length) * 100}%`,
                height: '100%',
                background: 'var(--talas-blue)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Word card */}
        <div
          style={{
            background: 'var(--talas-sky)',
            borderRadius: '14px',
            padding: '32px 24px',
            textAlign: 'center',
            border: '1px solid var(--talas-blue-soft)',
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--talas-blue)',
              marginBottom: '12px',
            }}
          >
            ANO ANG KAHULUGAN NITO?
          </div>
          <div
            style={{
              fontFamily: "'Fredoka', system-ui, sans-serif",
              fontSize: '36px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
            }}
          >
            {item.word}
          </div>
        </div>

        {/* Choices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {item.choices.map((choice, i) => {
            let bg = 'white'
            let borderColor = 'var(--talas-line)'
            let Icon: LucideIcon | null = null
            if (answered) {
              if (i === item.correctIndex) { bg = 'var(--talas-blue-soft)'; borderColor = 'var(--talas-green)'; Icon = Check }
              else if (i === selected) { bg = 'var(--talas-red-soft)'; borderColor = 'var(--talas-coral)'; Icon = X }
            } else if (i === selected) {
              bg = 'var(--talas-sky)'; borderColor = 'var(--talas-blue)'
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                style={{
                  width: '100%',
                  minHeight: '56px',
                  borderRadius: '14px',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: bg,
                  border: `2px solid ${borderColor}`,
                  cursor: answered ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '13px',
                    fontWeight: 700,
                    minWidth: '20px',
                    color: answered && i === item.correctIndex
                      ? 'var(--talas-green)'
                      : answered && i === selected
                        ? 'var(--talas-coral)'
                        : 'var(--talas-muted)',
                  }}
                >
                  {Icon ? <Icon size={16} aria-hidden="true" /> : choiceLabels[i]}
                </span>
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '15px',
                    color: 'var(--talas-charcoal)',
                  }}
                >
                  {choice}
                </span>
              </button>
            )
          })}
        </div>

        {/* Correct answer reveal */}
        {answered && (
          <div
            style={{
              background: 'var(--talas-mint)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '14px',
              color: 'var(--talas-green)',
            }}
          >
             <strong>{item.word}</strong> — {item.meaning}
          </div>
        )}

        <button
          type="button"
          disabled={!answered}
          onClick={handleNext}
          style={{
            width: '100%',
            minHeight: '56px',
            background: answered ? 'var(--talas-blue)' : 'var(--talas-blue-soft)',
            color: answered ? 'white' : 'var(--talas-muted)',
            border: 'none',
            borderRadius: '16px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '16px',
            fontWeight: 700,
            cursor: answered ? 'pointer' : 'not-allowed',
          }}
        >
          {isLast ? 'Tapusin ' : 'Susunod →'}
        </button>
      </div>
    </div>
  )
}
