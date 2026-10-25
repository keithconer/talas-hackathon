import { mockAssignment, mockPassage } from '../data/mockData'

interface Props {
  onDoneReading: () => void
}

export default function SilentPassage({ onDoneReading }: Props) {
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
      {/* Title bar */}
      <p
        style={{
          margin: '0 0 20px 0',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--talas-green)',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {mockAssignment.title}
      </p>

      {/* Passage */}
      <div style={{ flex: 1 }}>
        {mockPassage.map((paragraph, index) => (
          <p
            key={index}
            className="font-quicksand"
            style={{
              fontSize: '18px',
              lineHeight: 1.8,
              color: 'var(--talas-charcoal)',
              marginBottom: '20px',
              marginTop: 0,
            }}
          >
            {paragraph}
          </p>
        ))}
      </div>

      {/* Done reading button */}
      <div style={{ paddingTop: '16px' }}>
        <button
          type="button"
          onClick={onDoneReading}
          style={{
            width: '100%',
            minHeight: '56px',
            background: 'var(--talas-green)',
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: "'Inter', system-ui, sans-serif",
            cursor: 'pointer',
          }}
        >
          Tapos na Akong Magbasa
        </button>
      </div>
    </div>
  )
}
