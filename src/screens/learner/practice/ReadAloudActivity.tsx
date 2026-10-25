import { useState } from 'react'
import { ArrowLeft, Volume2 } from 'lucide-react'
import { readAloudPassage } from '../../../data/practiceData'

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
         Basahin Natin
      </div>
      <span
        style={{
          background: 'var(--talas-buttercream)',
          color: 'var(--talas-yellow-dark)',
          borderRadius: '10px',
          padding: '4px 10px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        Pagsasanay sa Pagbasa
      </span>
    </div>
  )
}

export default function ReadAloudActivity({ onComplete, onBack }: Props) {
  const { title, sentences } = readAloudPassage
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const handleSpeak = (index: number, text: string) => {
    // Use Web Speech API if available; fall back silently
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'fil-PH'
      utter.rate = 0.85
      setSpeaking(true)
      setHighlightIndex(index)
      utter.onend = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
    } else {
      // Just highlight without audio
      setHighlightIndex(index)
    }
  }

  const handleSpeakAll = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const fullText = sentences.join(' ')
      const utter = new SpeechSynthesisUtterance(fullText)
      utter.lang = 'fil-PH'
      utter.rate = 0.85
      setSpeaking(true)
      setHighlightIndex(0)
      // Approximate word-by-word highlight by timing
      let sentenceIndex = 0
      const avgDuration = (fullText.length / sentences.length) * 60  // rough ms per sentence
      const interval = setInterval(() => {
        sentenceIndex++
        if (sentenceIndex >= sentences.length) {
          clearInterval(interval)
          setHighlightIndex(null)
        } else {
          setHighlightIndex(sentenceIndex)
        }
      }, avgDuration)
      utter.onend = () => {
        clearInterval(interval)
        setSpeaking(false)
        setHighlightIndex(null)
      }
      utter.onerror = () => {
        clearInterval(interval)
        setSpeaking(false)
      }
      window.speechSynthesis.speak(utter)
    }
  }

  return (
    <div style={{ width: 'min(640px, 100%)', margin: '0 auto', minHeight: '100svh', background: 'var(--talas-paper)' }}>
      <TopBar onBack={onBack} />
      <div style={{ padding: 'clamp(12px, 4vw, 24px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Instruction card */}
        <div
          style={{
            background: 'var(--talas-buttercream)',
            borderRadius: '16px',
            padding: '10px 0',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            color: 'var(--talas-muted)',
          }}
        >
          Basahin nang malakas ang bawat pangungusap. Pindutin ang speaker para marinig ito.
        </div>

        {/* Story title */}
        <div
          style={{
            fontFamily: "'Fredoka', system-ui, sans-serif",
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--talas-charcoal)',
          }}
        >
          {title}
        </div>

        {/* Sentence cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sentences.map((sentence, i) => {
            const isHighlighted = highlightIndex === i
            return (
              <div
                key={i}
                style={{
                  background: isHighlighted ? 'var(--talas-mint)' : 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                {/* Sentence number */}
                <span
                  style={{
                    width: '24px',
                    flexShrink: 0,
                    color: isHighlighted ? 'var(--talas-blue)' : 'var(--talas-muted)',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>

                {/* Sentence text */}
                <span
                  style={{
                    flex: 1,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '17px',
                    lineHeight: 1.6,
                    color: 'var(--talas-charcoal)',
                    fontWeight: isHighlighted ? 700 : 400,
                  }}
                >
                  {sentence}
                </span>

                {/* Listen button */}
                <button
                  type="button"
                  onClick={() => handleSpeak(i, sentence)}
                  disabled={speaking}
                  style={{
                    width: '40px',
                    height: '40px',
                    background: isHighlighted ? 'var(--talas-green)' : 'var(--talas-sky)',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    cursor: speaking ? 'not-allowed' : 'pointer',
                    opacity: speaking && !isHighlighted ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Volume2 size={18} aria-hidden="true" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Play all button */}
        <button
          type="button"
          onClick={handleSpeakAll}
          disabled={speaking}
          style={{
            width: '100%',
            minHeight: '52px',
            background: 'transparent',
            border: '2px solid var(--talas-blue)',
            color: 'var(--talas-blue)',
            borderRadius: '16px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            cursor: speaking ? 'not-allowed' : 'pointer',
            opacity: speaking ? 0.5 : 1,
          }}
        >
          {speaking ? ' Nagpapatugtog...' : ' Pakinggan ang Buong Kuwento'}
        </button>

        {/* Done button */}
        <button
          type="button"
          onClick={() => onComplete(-1)}
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
          Tapos na akong Basahin
        </button>
      </div>
    </div>
  )
}
