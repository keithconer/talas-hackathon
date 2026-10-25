import ComprehensionActivity from './ComprehensionActivity'
import { getActivity } from '../../../data/contentBank'

interface Props {
  activityId: string
  onComplete: (scorePercent: number) => void
  onBack: () => void
}

/**
 * Routes to the correct activity component based on activityId.
 *
 * All Content Bank activities (mixed-reading, comprehension, word-recognition,
 * vocabulary, read-aloud) are passage + multiple-choice (or passage-only), so
 * they render through the generic ComprehensionActivity driven by the activity
 * id — which pulls the right passage, questions, and difficult words from the
 * Content Bank. Adding a new activity = add it to contentBank.ts.
 */
export default function PracticeActivity({ activityId, onComplete, onBack }: Props) {
  const activity = getActivity(activityId)
  if (activity) {
    return (
      <ComprehensionActivity
        activityId={activityId}
        onComplete={onComplete}
        onBack={onBack}
      />
    )
  }

  switch (activityId) {
    default:
      // Unknown activity — show a friendly fallback
      return (
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            minHeight: '100svh',
            background: 'var(--talas-paper)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            gap: '16px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontFamily: "'Fredoka', system-ui, sans-serif",
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--talas-charcoal)',
            }}
          >
            Hindi mahanap ang aktibidad.
          </div>
          <button
            type="button"
            onClick={() => onComplete(0)}
            style={{
              minHeight: '56px',
              padding: '0 32px',
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
            Bumalik
          </button>
        </div>
      )
  }
}
