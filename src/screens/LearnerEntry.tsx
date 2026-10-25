import { useState } from 'react'

interface Props {
  onStart: (name: string) => void
}

export default function LearnerEntry({ onStart }: Props) {
  const [name, setName] = useState<string>('')

  const handleSubmit = () => {
    if (name.trim()) {
      onStart(name.trim())
    }
  }

  const isDisabled = name.trim() === ''

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--talas-paper)',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 'var(--talas-radius-card)',
          padding: '32px',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 4px 20px rgba(36, 41, 35, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Kumusta!
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              color: 'var(--talas-muted)',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            Ilagay ang iyong pangalan
          </p>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Pangalan mo..."
          aria-label="Pangalan"
          style={{
            width: '100%',
            minHeight: '48px',
            border: '2px solid var(--talas-line)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '18px',
            fontFamily: "'Inter', system-ui, sans-serif",
            color: 'var(--talas-charcoal)',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--talas-green)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--talas-line)'
          }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isDisabled}
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
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          Magsimula
        </button>
      </div>
    </div>
  )
}
