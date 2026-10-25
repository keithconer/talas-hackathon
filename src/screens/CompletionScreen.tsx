import FrogMascot from '../components/FrogMascot'

interface Props {
  learnerName: string
  score: number
  totalQuestions: number
  onDone: () => void
}

export default function CompletionScreen({ learnerName, score, totalQuestions, onDone }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        background: 'var(--talas-paper)',
        textAlign: 'center',
        gap: '20px',
      }}
    >
      {/* Frog mascot */}
      <div style={{ marginTop: '8px' }}>
        <FrogMascot size={112} />
      </div>

      {/* Heading */}
      <h1
        style={{
          margin: 0,
          fontSize: '32px',
          fontWeight: 700,
          color: 'var(--talas-green)',
          fontFamily: "'Inter', system-ui, sans-serif",
          lineHeight: 1.3,
        }}
      >
        Mahusay, {learnerName}!
      </h1>

      {/* Score card */}
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px 32px',
          boxShadow: '0 4px 20px rgba(36, 41, 35, 0.08)',
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            fontFamily: "'Inter', system-ui, sans-serif",
            color: 'var(--talas-charcoal)',
          }}
        >
          <span style={{ color: 'var(--talas-yellow)' }}>{score}</span>
          {' '}sa {totalQuestions} ang tama
        </p>
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={onDone}
        style={{
          width: '100%',
          minHeight: '56px',
          background: 'var(--talas-yellow)',
          color: 'var(--talas-charcoal)',
          border: 'none',
          borderRadius: '14px',
          fontSize: '20px',
          fontWeight: 700,
          fontFamily: "'Inter', system-ui, sans-serif",
          cursor: 'pointer',
        }}
      >
        Tapos
      </button>
    </div>
  )
}
