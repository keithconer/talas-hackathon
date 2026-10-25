import { mockAssignment } from '../data/mockData'

interface Props {
  learnerName: string
  onStartReading: () => void
}

export default function ReadingLobby({ learnerName, onStartReading }: Props) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        gap: '24px',
        background: 'var(--talas-paper)',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--talas-charcoal)',
          fontFamily: "'Inter', system-ui, sans-serif",
          textAlign: 'center',
        }}
      >
        Magandang araw, {learnerName}!
      </p>

      <div
        style={{
          background: 'white',
          borderRadius: 'var(--talas-radius-card)',
          padding: '24px',
          width: '100%',
          boxShadow: '0 4px 20px rgba(36, 41, 35, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--talas-green)',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {mockAssignment.title}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              color: 'var(--talas-muted)',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {mockAssignment.level}
          </span>

          <span
            style={{
              fontSize: '14px',
              color: 'var(--talas-muted)',
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
             {mockAssignment.estimatedMinutes} minuto
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartReading}
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
          cursor: 'pointer',
        }}
      >
        Simulan ang Pagbasa
      </button>
    </div>
  )
}
