import FrogMascot from '../../components/FrogMascot'

interface Props {
  learnerName: string
  activityTitle: string
  scorePercent: number
  onKeepPracticing: () => void
  onBackToDashboard: () => void
}

export default function PracticeCompletion({
  activityTitle,
  scorePercent,
  onKeepPracticing,
  onBackToDashboard,
}: Props) {
  // Determine encouragement text
  let encouragementText: string | null = null
  if (scorePercent >= 80) {
    encouragementText = 'Napakahusay! Patuloy ka!'
  } else if (scorePercent >= 60) {
    encouragementText = 'Magaling! Tuloy lang!'
  } else if (scorePercent >= 0) {
    encouragementText = 'Okay lang, subukan ulit!'
  }
  // scorePercent === -1 → no encouragement text (read-aloud, no score)

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--talas-paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(12px, 4vw, 24px)',
      }}
    >
      <div
        style={{
          width: 'min(480px, 100%)',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '20px',
          textAlign: 'center',
        }}
      >
        <FrogMascot size={120} />

        <h2
          style={{
            fontFamily: "'Fredoka', system-ui, sans-serif",
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--talas-green)',
            margin: 0,
          }}
        >
          {encouragementText ?? 'Tapos na'}
        </h2>

        <p
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '16px',
            color: 'var(--talas-charcoal)',
            margin: 0,
          }}
        >
          Natapos mo ang {activityTitle}.
        </p>

        {/* Score badge — only shown when scorePercent >= 0 */}
        {scorePercent >= 0 && (
          <div
            style={{
              background: 'var(--talas-buttercream)',
              borderRadius: '16px',
              border: '1px solid var(--talas-yellow)',
              padding: '16px 32px',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
            }}
          >
            {scorePercent}%
          </div>
        )}

        {/* Keep Practicing button */}
        <button
          type="button"
          onClick={onKeepPracticing}
          style={{
            width: '100%',
            minHeight: '48px',
            background: 'var(--talas-green)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Magpatuloy sa Pagsasanay
        </button>

        {/* Back to Dashboard button */}
        <button
          type="button"
          onClick={onBackToDashboard}
          style={{
            width: '100%',
            minHeight: '48px',
            background: 'transparent',
            color: 'var(--talas-green)',
            border: '1px solid var(--talas-line)',
            borderRadius: '10px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Bumalik sa Dashboard
        </button>
      </div>
    </div>
  )
}
