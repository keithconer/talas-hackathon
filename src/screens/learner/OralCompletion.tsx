import { useRef, useState } from 'react'
import FrogMascot from '../../components/FrogMascot'
import type { OralResult } from './OralAssessment'
import { accuracyEncouragement } from '../../reading/crla'

interface Props {
  result: OralResult | null
  onContinue: () => void
  firstBadgeUnlocked?: boolean
}

export default function OralCompletion({ result, onContinue, firstBadgeUnlocked = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playTime, setPlayTime] = useState(0)

  const accuracy = result?.accuracy ?? 0
  // Tone + encouragement come from the CRLA standard (see reading/crla.ts) so
  // the learner's feedback matches the proficiency level the teacher sees.
  const { tone, label: encouragement } = accuracyEncouragement(accuracy)
  const toneColor =
    tone === 'strong'
      ? 'var(--talas-green)'
      : tone === 'ok'
        ? 'var(--talas-blue)'
        : 'var(--talas-coral)'
  const label = tone === 'strong' ? `${encouragement} ` : encouragement

  function seekToWord(timeSec?: number) {
    const audio = audioRef.current
    if (!audio || timeSec === undefined) return
    audio.currentTime = Math.max(0, timeSec)
    void audio.play().catch(() => {})
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--talas-paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        maxWidth: '680px',
        margin: '0 auto',
      }}
    >
      <FrogMascot size={120} />
      <h1
        style={{
          margin: '12px 0 0 0',
          fontFamily: "'Fredoka', system-ui, sans-serif",
          fontSize: '32px',
          fontWeight: 700,
          color: toneColor,
          textAlign: 'center',
        }}
      >
        {label}
      </h1>
      <p
        style={{
          margin: '6px 0 0 0',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '16px',
          color: 'var(--talas-charcoal)',
          textAlign: 'center',
        }}
      >
        Natapos mo ang pasalitang pagbasa.
      </p>

      {result && (
        <>
          {/* Score + stats */}
          <div
            style={{
              marginTop: '20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              width: '100%',
            }}
          >
            {[
              { v: `${accuracy}%`, l: 'Katumpakan', c: toneColor },
              { v: result.correctWords, l: 'Tama', c: 'var(--talas-green)' },
              {
                v: result.totalWords - result.correctWords,
                l: 'Mali / Nalaktawan',
                c: 'var(--talas-coral)',
              },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  background: 'white',
                  border: '1px solid var(--talas-blue-soft)',
                  borderRadius: '16px',
                  padding: '16px 8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Fredoka', system-ui, sans-serif",
                    fontSize: '26px',
                    fontWeight: 700,
                    color: s.c,
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: '11px',
                    color: 'var(--talas-muted)',
                    marginTop: '2px',
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>

          {/* Recording for teacher review */}
          {result.audioUrl && (
            <div style={{ width: '100%', marginTop: '18px', textAlign: 'center' }}>
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--talas-charcoal)',
                  marginBottom: '6px',
                }}
              >
                Recording
              </div>
              <audio
                ref={audioRef}
                controls
                src={result.audioUrl}
                style={{ width: '100%' }}
                onTimeUpdate={(e) => setPlayTime(e.currentTarget.currentTime)}
              />
            </div>
          )}

          {/* Word-by-word review — click a word to jump the recording */}
          <div
            style={{
              width: '100%',
              marginTop: '18px',
              background: 'white',
              border: '1px solid var(--talas-blue-soft)',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <div
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--talas-green)',
                marginBottom: '4px',
              }}
            >
              Pagsusuri ng Pagbasa
            </div>
            {result.audioUrl && (
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: '12px',
                  color: 'var(--talas-muted)',
                  marginBottom: '10px',
                }}
              >
                I-click ang salita para lumukso ang recording.
              </div>
            )}
            <div
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '18px',
                lineHeight: 1.8,
              }}
            >
              {result.words.map((w) => {
                const next = result.words[w.index + 1]?.timeSec
                const active =
                  w.timeSec !== undefined &&
                  playTime >= w.timeSec &&
                  (next === undefined || playTime < next)
                return (
                  <button
                    key={w.index}
                    type="button"
                    onClick={() => seekToWord(w.timeSec)}
                    disabled={!result.audioUrl || w.timeSec === undefined}
                    title={w.timeSec !== undefined ? `${w.timeSec.toFixed(1)}s` : undefined}
                    style={{
                      font: 'inherit',
                      border: 'none',
                      margin: '0 1px 4px',
                      padding: '2px 5px',
                      borderRadius: '8px',
                      cursor: result.audioUrl ? 'pointer' : 'default',
                      background: active
                        ? 'var(--talas-sky)'
                        : w.correct
                          ? 'var(--talas-mint)'
                          : 'var(--talas-red-soft)',
                      color: active
                        ? 'var(--talas-blue)'
                        : w.correct
                          ? 'var(--talas-green)'
                          : 'var(--talas-coral)',
                      boxShadow: active ? '0 0 0 2px var(--talas-blue)' : 'none',
                    }}
                  >
                    {w.expected}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onContinue}
        style={{
          marginTop: '28px',
          width: '100%',
          minHeight: '56px',
          background: 'var(--talas-green)',
          color: 'white',
          border: 'none',
          borderRadius: '16px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: '18px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Magpatuloy →
      </button>
      {firstBadgeUnlocked && (
        <div role="dialog" aria-modal="true" aria-labelledby="first-badge-title" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', padding: 20, background: 'rgba(20,35,30,.5)' }}>
          <div style={{ width: 'min(400px, 100%)', padding: 28, borderRadius: 20, background: 'white', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div aria-hidden="true" style={{ fontSize: 52 }}>🏅</div>
            <h2 id="first-badge-title" style={{ fontFamily: "'Fredoka', system-ui, sans-serif", color: 'var(--talas-green)', margin: '8px 0' }}>Na-unlock mo ang Unang Hakbang!</h2>
            <p style={{ fontFamily: "'Inter', system-ui, sans-serif", color: 'var(--talas-charcoal)' }}>Naitala na rin ito sa iyong profile.</p>
            <button type="button" onClick={onContinue} style={{ minWidth: 140, minHeight: 46, border: 0, borderRadius: 12, background: 'var(--talas-green)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Magpatuloy</button>
          </div>
        </div>
      )}
    </div>
  )
}
