import { useState } from 'react'
import { ArrowLeft, Check, X, type LucideIcon } from 'lucide-react'
import { comprehensionPassage } from '../../../data/practiceData'
import type { WordHelp } from '../../../data/practiceData'
import { getActivity } from '../../../data/contentBank'

interface Props {
  onComplete: (scorePercent: number) => void
  onBack: () => void
  /** Content Bank activity id (e.g. "L2-MIX-001"). Falls back to demo content. */
  activityId?: string
}

/** Shape the reading UI renders — same for demo content and Content Bank. */
interface ReadingContent {
  title: string
  paragraphs: string[]
  wordHelp: WordHelp[]
  questions: { question: string; choices: string[]; correctIndex: number; explanation?: string }[]
}

/** Adapts a Content Bank activity (by id) into the reading UI shape. */
function contentForActivity(activityId: string | undefined): ReadingContent {
  if (activityId) {
    const a = getActivity(activityId)
    if (a) {
      return {
        title: a.title,
        paragraphs: a.passage,
        wordHelp: a.difficultWords.map((w) => ({
          word: w.word,
          simpleDefinition: w.meaning,
          example: w.example,
        })),
        questions: a.questions.map((q) => ({
          question: q.prompt,
          choices: q.choices,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      }
    }
  }
  // Fallback: legacy demo passage.
  return {
    title: comprehensionPassage.title,
    paragraphs: comprehensionPassage.paragraphs,
    wordHelp: comprehensionPassage.wordHelp,
    questions: comprehensionPassage.questions,
  }
}

// ── Top bar (shared across phases) ──
function TopBar({ label, onBack }: { label: string; onBack: () => void }) {
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
        {label}
      </div>
      <span
        style={{
          color: 'var(--talas-muted)',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        Pag-unawa
      </span>
    </div>
  )
}

// ─── Word Help Tooltip ────────────────────────────────────────────────────────

function WordHelpChip({ help }: { help: WordHelp }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'var(--talas-buttercream)',
          color: 'var(--talas-yellow-dark)',
          border: '1px solid var(--talas-yellow)',
          borderRadius: '6px',
          padding: '1px 6px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 'inherit',
          fontWeight: 700,
          cursor: 'pointer',
          textDecoration: 'underline dotted',
          textUnderlineOffset: '3px',
        }}
      >
        {help.word}
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '220px',
            background: 'white',
            border: '1px solid var(--talas-yellow)',
            borderRadius: '12px',
            padding: '10px 12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--talas-yellow-dark)',
              marginBottom: '4px',
            }}
          >
            {help.word}
          </div>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '13px',
              color: 'var(--talas-charcoal)',
              marginBottom: '4px',
            }}
          >
            {help.simpleDefinition}
          </div>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              color: 'var(--talas-muted)',
              fontStyle: 'italic',
            }}
          >
            "{help.example}"
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              marginTop: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--talas-green)',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '12px',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 600,
            }}
          >
            Isara
          </button>
        </div>
      )}
    </span>
  )
}

// ─── Render paragraph with clickable word-help chips ─────────────────────────

function AnnotatedParagraph({ text, wordHelp }: { text: string; wordHelp: WordHelp[] }) {
  const helpMap = new Map(wordHelp.map((h) => [h.word, h]))
  // Split on word boundaries, preserving spaces and punctuation
  const tokens = text.split(/(\s+)/)
  return (
    <span>
      {tokens.map((token, i) => {
        const clean = token.replace(/[.,!?;:'"]/g, '')
        const help = helpMap.get(clean)
        if (help) {
          return <WordHelpChip key={i} help={help} />
        }
        return <span key={i}>{token}</span>
      })}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ComprehensionActivity({ onComplete, onBack, activityId }: Props) {
  const { title, paragraphs, wordHelp, questions } = contentForActivity(activityId)
  // Read-aloud / passage-only activities have no questions — if the bank
  // activity carries none, start directly in a state that scores on finish.
  const hasQuestions = questions.length > 0
  const [phase, setPhase] = useState<'reading' | 'quiz'>('reading')
  const [qIndex, setQIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)

  const currentQ = questions[qIndex]
  const isLast = qIndex === questions.length - 1
  const choiceLabels = ['A', 'B', 'C', 'D']

  const handleAnswer = (i: number) => {
    if (answered) return
    setSelected(i)
    setAnswered(true)
    if (i === currentQ.correctIndex) setCorrectCount((c) => c + 1)
  }

  const handleNext = () => {
    if (isLast) {
      onComplete(Math.round((correctCount / questions.length) * 100))
    } else {
      setQIndex((q) => q + 1)
      setSelected(null)
      setAnswered(false)
    }
  }

  // ── READING phase ──
  if (phase === 'reading') {
    return (
      <div style={{ width: 'min(640px, 100%)', margin: '0 auto', minHeight: '100svh', background: 'var(--talas-paper)' }}>
        <TopBar label={title} onBack={onBack} />
        <div style={{ padding: 'clamp(12px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Passage card */}
          <div
            style={{
              background: 'white',
              borderRadius: '14px',
              padding: '24px',
              border: '1px solid var(--talas-blue-soft)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <div
              style={{
                fontFamily: "'Fredoka', system-ui, sans-serif",
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--talas-charcoal)',
                marginBottom: '16px',
              }}
            >
              {title}
            </div>
            {paragraphs.map((para, i) => (
              <p
                key={i}
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '16px',
                  lineHeight: 2,
                  color: 'var(--talas-charcoal)',
                  margin: '0 0 12px 0',
                }}
              >
                <AnnotatedParagraph text={para} wordHelp={wordHelp} />
              </p>
            ))}
            {/* Word help legend */}
            <div
              style={{
                marginTop: '8px',
                background: 'var(--talas-buttercream)',
                borderRadius: '10px',
                padding: '8px 12px',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '11px',
                color: 'var(--talas-yellow-dark)',
              }}
            >
               I-tap ang mga <strong>salitang may guhit</strong> para malaman ang kahulugan.
            </div>
          </div>

          <button
            type="button"
            onClick={() => (hasQuestions ? setPhase('quiz') : onComplete(100))}
            style={{
              width: '100%',
              minHeight: '56px',
              background: 'var(--talas-green)',
              color: 'white',
              border: 'none',
              borderRadius: '16px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {hasQuestions ? 'Sagutin ang mga Tanong →' : 'Tapusin '}
          </button>
        </div>
      </div>
    )
  }

  // ── QUIZ phase ──
  return (
    <div style={{ width: 'min(640px, 100%)', margin: '0 auto', minHeight: '100svh', background: 'var(--talas-paper)' }}>
      <TopBar label={title} onBack={onBack} />
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
            Tanong {qIndex + 1} ng {questions.length}
          </div>
          <div style={{ height: '6px', background: 'var(--talas-line)', borderRadius: '3px' }}>
            <div
              style={{
                width: `${((qIndex + (answered ? 1 : 0)) / questions.length) * 100}%`,
                height: '100%',
                background: 'var(--talas-green)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Question card */}
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '24px',
            border: '1px solid var(--talas-blue-soft)',
          }}
        >
          <div
            style={{
              fontFamily: "'Fredoka', system-ui, sans-serif",
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
              marginBottom: '20px',
              lineHeight: 1.5,
            }}
          >
            {currentQ.question}
          </div>

          {currentQ.choices.map((choice, i) => {
            let bg = 'white'
            let borderColor = 'var(--talas-line)'
            let Icon: LucideIcon | null = null
            if (answered) {
              if (i === currentQ.correctIndex) { bg = 'var(--talas-blue-soft)'; borderColor = 'var(--talas-green)'; Icon = Check }
              else if (i === selected) { bg = 'var(--talas-red-soft)'; borderColor = 'var(--talas-coral)'; Icon = X }
            } else if (i === selected) {
              borderColor = 'var(--talas-blue)'; bg = 'var(--talas-sky)'
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleAnswer(i)}
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
                  marginBottom: '8px',
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
                    color: answered && i === currentQ.correctIndex
                      ? 'var(--talas-green)'
                      : answered && i === selected
                        ? 'var(--talas-coral)'
                        : 'var(--talas-charcoal)',
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

        {/* Next button */}
        <button
          type="button"
          disabled={!answered}
          onClick={handleNext}
          style={{
            width: '100%',
            minHeight: '56px',
            background: answered ? 'var(--talas-green)' : 'var(--talas-blue-soft)',
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
