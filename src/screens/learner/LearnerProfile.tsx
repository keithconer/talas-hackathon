import FrogMascot from '../../components/FrogMascot'
import { Award, BookOpen, Check, Target, type LucideIcon } from 'lucide-react'
import type { PracticeProfile } from '../../data/practiceData'
import { activityRegistry } from '../../data/practiceData'
import { useAssessmentAttempts } from '../../features/teacher/profile/useAssessmentAttempts'

interface Props {
  learnerName: string
  learnerId: string
  practiceProfile: PracticeProfile
  onBack: () => void
  onExit: () => void
}

const FONT_DISPLAY = "'Fredoka', system-ui, sans-serif"
const FONT_UI = "'Inter', system-ui, sans-serif"
const FONT_READ = "'Inter', system-ui, sans-serif"

interface Badge {
  icon: string
  label: string
  earned: boolean
}

export default function LearnerProfile({
  learnerName,
  learnerId,
  practiceProfile,
  onBack,
  onExit,
}: Props) {
  const displayName = learnerName.split(' ')[0] || learnerName || 'Mag-aaral'
  const { oralAttempts, silentAttempts, pictureAttempts, interventionPlans } = useAssessmentAttempts(learnerId)

  const interventionCount = interventionPlans.flatMap((plan) => plan.activities).filter((activity) => Boolean(activity.result)).length
  const completedCount = practiceProfile.completedActivityIds.length + oralAttempts.length + silentAttempts.length + pictureAttempts.length + interventionCount
  const scores = practiceProfile.recentScores
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

  // Child-friendly badges derived from real practice data (no new scoring).
  const badges: Badge[] = [
    { icon: '/imgs/badges/first-step.svg', label: 'Unang Hakbang', earned: completedCount >= 1 },
    { icon: '/imgs/badges/diligent-reader.svg', label: 'Masipag Magbasa', earned: false },
    { icon: '/imgs/badges/reading-streak.svg', label: 'Sunod-sunod', earned: false },
    { icon: '/imgs/badges/reading-star.svg', label: 'Bituin ng Pagbasa', earned: false },
  ]
  const earnedCount = badges.filter((b) => b.earned).length

  // Titles of the activities the learner has finished, from the registry.
  const completedTitles = [
    ...oralAttempts.map((attempt) => `Pasalitang Pagbasa · ${attempt.accuracy}% · ${new Date(attempt.createdAt).toLocaleDateString()}`),
    ...silentAttempts.map((attempt) => `${attempt.title} · Tahimik na Pagbasa · ${attempt.scorePercent}% (${attempt.correctAnswers}/${attempt.totalQuestions})`),
    ...pictureAttempts.map((attempt) => `${attempt.title} · ${attempt.scorePercent}%`),
    ...interventionPlans.flatMap((plan) => plan.activities.filter((activity) => activity.result).map((activity) => activity.title)),
    ...practiceProfile.completedActivityIds.map((id) => activityRegistry.find((a) => a.id === id)?.title).filter((title): title is string => Boolean(title)),
  ].reverse()

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--talas-paper)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          margin: '0 auto',
          padding: 'clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px) 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(16px, 2.5vw, 28px)',
        }}
      >
        {/* ───────── TOP BAR ───────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'white',
              color: 'var(--talas-charcoal)',
              border: '1px solid var(--talas-blue-soft)',
              borderRadius: '10px',
              padding: '8px 16px',
              fontFamily: FONT_UI,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Bumalik
          </button>
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--talas-green)',
              letterSpacing: '0.5px',
            }}
          >
            TALAS
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-label={`Profile ni ${displayName}`} style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--talas-green)', color: 'white', fontFamily: FONT_UI, fontWeight: 700 }}>{displayName.slice(0, 2).toUpperCase()}</span>
            <button type="button" onClick={onExit} style={{ background: 'white', color: 'var(--talas-muted)', border: '1px solid var(--talas-blue-soft)', borderRadius: '10px', padding: '8px 12px', fontFamily: FONT_UI, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Mag-logout</button>
          </div>
        </div>

        {/* ───────── HERO: who am I ───────── */}
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
          padding: 'clamp(16px, 2.5vw, 24px)',
            border: '1px solid var(--talas-blue-soft)',
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <FrogMascot size={72} />
          <div style={{ flex: 1, minWidth: '220px' }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 'clamp(26px, 3.2vw, 34px)',
                fontWeight: 700,
                color: 'var(--talas-charcoal)',
                lineHeight: 1.15,
                marginTop: '2px',
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
                color: 'var(--talas-green)',
                fontFamily: FONT_UI,
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {oralAttempts.length > 0
                ? `Antas ${practiceProfile.currentLevel} ng pagbasa`
                : 'Basahin ang gawain para matukoy ang antas'}
            </div>
          </div>
        </div>

        {/* ───────── STAT CARDS ───────── */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <StatBox icon={Check} value={`${completedCount}`} label="Natapos na gawain" bg="var(--talas-mint)" color="var(--talas-green)" />
          <StatBox icon={Award} value={`${earnedCount} / ${badges.length}`} label="Mga nakamit" bg="var(--talas-sky)" color="var(--talas-blue)" />
          <StatBox icon={Target} value={scores.length > 0 ? `${avgScore}%` : '—'} label="Karaniwang tama" bg="var(--talas-buttercream)" color="var(--talas-yellow-dark)" />
        </div>

        {/* ───────── BADGES ───────── */}
        <section
          style={{
            background: 'white',
            borderRadius: '14px',
            border: '1px solid var(--talas-blue-soft)',
            padding: 'clamp(18px, 2.5vw, 26px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: '18px', fontWeight: 700, color: 'var(--talas-charcoal)' }}>
            Mga Nakamit
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', columnGap: '20px', rowGap: '4px' }}>
            {badges.map((b) => (
              <div
                key={b.label}
                style={{
                  padding: '10px 0',
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr auto',
                  gap: '10px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--talas-line)',
                }}
              >
                <img
                  src={b.icon}
                  alt=""
                  aria-hidden="true"
                  width="30"
                  height="30"
                  style={{ imageRendering: 'pixelated', opacity: b.earned ? 1 : 0.3 }}
                />
                <span style={{ fontFamily: FONT_UI, fontSize: '13px', fontWeight: 600, color: 'var(--talas-charcoal)' }}>
                  {b.label}
                </span>
                <span style={{ fontFamily: FONT_UI, fontSize: '11px', color: b.earned ? 'var(--talas-green)' : 'var(--talas-muted)' }}>
                  {b.earned ? 'Nakuha' : 'Gumawa para ma-unlock'}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── RECENT ACTIVITIES ───────── */}
        <section
          style={{
            background: 'white',
            borderRadius: '14px',
            border: '1px solid var(--talas-blue-soft)',
            padding: 'clamp(18px, 2.5vw, 26px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: '18px', fontWeight: 700, color: 'var(--talas-charcoal)' }}>
            Mga Nagawa Ko
          </div>
          {completedTitles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {completedTitles.map((title, i) => (
                <div
                  key={`${title}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'var(--talas-mint)',
                    borderRadius: '14px',
                    padding: '12px 16px',
                  }}
                >
                  <BookOpen size={19} color="var(--talas-blue)" aria-hidden="true" />
                  <span style={{ fontFamily: FONT_READ, fontSize: '15px', fontWeight: 600, color: 'var(--talas-charcoal)' }}>
                    {title}
                  </span>
                  <Check size={17} color="var(--talas-blue)" aria-hidden="true" />
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 16px',
                background: 'var(--talas-paper)',
                borderRadius: '16px',
              }}
            >
              <FrogMascot size={64} />
              <div style={{ fontFamily: FONT_READ, fontSize: '15px', color: 'var(--talas-muted)', marginTop: '10px' }}>
                Wala ka pang natatapos na gawain. Magsimula na tayo.
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatBox({
  icon,
  value,
  label,
  bg,
  color,
}: {
  icon: LucideIcon
  value: string
  label: string
  bg: string
  color: string
}) {
  const Icon = icon
  return (
    <div
      style={{
        flex: 1,
        minWidth: '150px',
        background: bg,
        borderRadius: '14px',
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}
    >
      <span style={{ color, lineHeight: 0 }}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: '22px', fontWeight: 700, color, lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'var(--talas-muted)' }}>{label}</div>
      </div>
    </div>
  )
}
