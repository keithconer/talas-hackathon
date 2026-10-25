import FrogMascot from '../../components/FrogMascot'
import { mockAssignment } from '../../data/mockData'

interface Props {
  learnerName: string
  onDone: () => void
}

export default function FormalAssessmentCompletion({ learnerName, onDone }: Props) {
  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--talas-paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'clamp(12px, 4vw, 32px)',
        width: 'min(520px, 100%)',
        margin: '0 auto',
      }}
    >
      {/* Submission status */}
      <div
        style={{
          color: 'var(--talas-green)',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '12px',
          fontWeight: 600,
          alignSelf: 'center',
          marginBottom: '8px',
        }}
      >
        Ligtas Na Naipadala kay Teacher Maria
      </div>

      <FrogMascot size={112} />

      <h1
        style={{
          margin: '16px 0 0 0',
          fontFamily: "'Fredoka', system-ui, sans-serif",
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--talas-green)',
          textAlign: 'center',
        }}
      >
        Napakagaling mo, {learnerName}!
      </h1>

      <p
        style={{
          margin: '8px 0 0 0',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '15px',
          color: 'var(--talas-muted)',
          textAlign: 'center',
          maxWidth: '320px',
        }}
      >
        Naipadala na ang iyong pagbasa. Hintayin ang komento ng guro.
      </p>

      {/* Audio button */}
      <button
        type="button"
        onClick={() => {}}
        style={{
          border: '1px solid var(--talas-line)',
          background: 'transparent',
          color: 'var(--talas-blue)',
          borderRadius: '14px',
          minHeight: '48px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '14px',
          padding: '0 20px',
          cursor: 'pointer',
          marginTop: '20px',
          width: '100%',
        }}
      >
        Pakinggan ang Bati ni Kokoy
      </button>

      {/* Recently completed card */}
      <div
        style={{
          marginTop: '20px',
          background: 'var(--talas-buttercream)',
          borderRadius: '16px',
          padding: '16px',
          border: 'none',
          alignSelf: 'stretch',
        }}
      >
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '10px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--talas-yellow-dark)',
            marginBottom: '6px',
          }}
        >
          KAKATAPOS LAMANG
        </div>
        <div
          style={{
            fontFamily: "'Fredoka', system-ui, sans-serif",
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--talas-charcoal)',
          }}
        >
          {mockAssignment.title}
        </div>
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '13px',
            color: 'var(--talas-muted)',
            marginTop: '4px',
          }}
        >
          {mockAssignment.level} · {mockAssignment.estimatedMinutes} minuto
        </div>
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          marginTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignSelf: 'stretch',
        }}
      >
        <button
          type="button"
          onClick={onDone}
          style={{
            width: '100%',
            minHeight: '48px',
            background: 'var(--talas-green)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Bumalik sa Bahay
        </button>

        <button
          type="button"
          onClick={onDone}
          style={{
            width: '100%',
            minHeight: '48px',
            background: 'transparent',
            color: 'var(--talas-green)',
            border: '1px solid var(--talas-line)',
            borderRadius: '16px',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Magpatuloy sa Libreng Pagsasanay
        </button>
      </div>

    </div>
  )
}
