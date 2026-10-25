import FrogMascot from '../../components/FrogMascot'
import { mockAssignment } from '../../data/mockData'
import type { InterventionPlan } from '../../data'

const DASHBOARD_ICONS = {
  book: '/imgs/dashboard/pixel-book.svg',
  streak: '/imgs/dashboard/pixel-streak.svg',
  award: '/imgs/dashboard/pixel-award.svg',
  shield: '/imgs/dashboard/pixel-shield.svg',
  bell: '/imgs/dashboard/pixel-bell.svg',
} as const

interface Props {
  learnerName: string
  onLogout: () => void
  onStartAssessment: () => void
  assessmentLocked?: boolean
  onStartPractice: () => void
  onStartPicturePractice: () => void
  onGoToProfile: () => void
  /** Automatically selected reading title after the baseline assessment. */
  readingTitle?: string
  /** Automatically selected Content Bank level (1–5). */
  automaticLevel?: number
  /** Active or assigned reading intervention plan (never overwrites existing tasks). */
  interventionPlan?: InterventionPlan | null
  /** Opens the dedicated student intervention workspace. */
  onStartIntervention?: (activityId?: string) => void
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const FONT_DISPLAY = "'Fredoka', system-ui, sans-serif"
const FONT_UI = "'Inter', system-ui, sans-serif"
const FONT_READ = "'Inter', system-ui, sans-serif"

/** Small stat chip for the hero row. */
function StatCard({
  icon,
  value,
  label,
  bg,
  color,
}: {
  icon: string
  value: string
  label: string
  bg: string
  color: string
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: bg,
        borderRadius: '14px',
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <img
        src={icon}
        alt=""
        aria-hidden="true"
        width="28"
        height="28"
        style={{ imageRendering: 'pixelated', flexShrink: 0 }}
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '20px',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: 'var(--talas-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

export default function LearnerDashboard({
  learnerName,
  onLogout,
  onStartAssessment,
  assessmentLocked = false,
  onGoToProfile,
  readingTitle,
  automaticLevel,
  interventionPlan,
  onStartIntervention,
}: Props) {
  const displayName = learnerName.split(' ')[0] || learnerName || 'Mag-aaral'
  const initials = getInitials(learnerName || 'M')

  const totalInterventionActivities = interventionPlan?.activities.length ?? 0
  const completedInterventionActivities =
    interventionPlan?.activities.filter((a) => Boolean(a.result)).length ?? 0
  const pendingInterventionActivities = Math.max(
    0,
    totalInterventionActivities - completedInterventionActivities,
  )

  const gradedInterventionActivities =
    interventionPlan?.activities.filter(
      (a) => a.result && a.result.maxScore > 0,
    ) ?? []
  const interventionAveragePercent =
    gradedInterventionActivities.length > 0
      ? Math.round(
          gradedInterventionActivities.reduce(
            (sum, a) =>
              sum + (a.result!.finalScore / a.result!.maxScore) * 100,
            0,
          ) / gradedInterventionActivities.length,
        )
      : null

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--talas-green)',
              letterSpacing: '0.5px',
            }}
          >
            TALAS
          </span>
          <span
            style={{
              color: 'var(--talas-muted)',
              fontFamily: FONT_UI,
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Baitang 2 · Sampaguita
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: FONT_UI, fontSize: '13px', color: 'var(--talas-charcoal)' }}>
              {displayName}
            </span>
            <div
              style={{
                width: '40px',
                height: '40px',
                background: 'var(--talas-green)',
                color: 'white',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: FONT_UI,
                fontSize: '14px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <button type="button" onClick={onLogout} aria-label="Mag-logout" title="Mag-logout" style={{ border: '1px solid var(--talas-line)', borderRadius: '10px', background: 'white', color: 'var(--talas-muted)', padding: '8px 10px', fontFamily: FONT_UI, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Mag-logout
            </button>
          </div>
        </div>

        {/* ───────── INTERVENTION NOTIFICATION BANNER (NON-OVERWRITING) ───────── */}
        {interventionPlan && totalInterventionActivities > 0 && (
          <div
            role="status"
            style={{
              background: 'white',
              border: '1px solid var(--talas-line)',
              borderRadius: '14px',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '250px' }}>
              <img src={DASHBOARD_ICONS.bell} alt="" aria-hidden="true" width="28" height="28" style={{ imageRendering: 'pixelated', flexShrink: 0 }} />
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--talas-charcoal)',
                    }}
                  >
                    Abiso sa Mag-aaral: May Gawaing Interbensyon Ka sa Pagbasa!
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: FONT_READ,
                    fontSize: '13px',
                    color: 'var(--talas-muted)',
                    marginTop: '4px',
                  }}
                >
                  {pendingInterventionActivities > 0
                    ? `${pendingInterventionActivities} gawaing inihanda ng guro · ${interventionPlan.recommendedCategories.join(', ')}`
                    : `Natapos mo na ang ${totalInterventionActivities} gawain. Maaari mong tingnan ang hiwalay na iskor.`}
                </div>
              </div>
            </div>

            {onStartIntervention && (
              <button
                type="button"
                onClick={() => onStartIntervention()}
                style={{
                  background: 'var(--talas-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  minHeight: '42px',
                  padding: '10px 16px',
                  fontFamily: FONT_UI,
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {pendingInterventionActivities > 0
                  ? 'Buksan ang Interbensyon '
                  : 'Tingnan ang Iskor sa Interbensyon '}
              </button>
            )}
          </div>
        )}

        {/* ───────── HERO: greeting + stats ───────── */}
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: 'clamp(20px, 3vw, 32px)',
            border: '1px solid var(--talas-line)',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FrogMascot size={72} />
            <div style={{ flex: 1, minWidth: '220px' }}>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 'clamp(24px, 3vw, 32px)',
                  fontWeight: 700,
                  color: 'var(--talas-charcoal)',
                  lineHeight: 1.15,
                }}
              >
                Magandang araw, {displayName}!
              </div>
            </div>
          </div>

          {/* Stat row */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <StatCard
              icon={DASHBOARD_ICONS.book}
              value="Antas 2"
              label="Antas ng pagbasa"
              bg="var(--talas-mint)"
              color="var(--talas-green)"
            />
            <StatCard
              icon={DASHBOARD_ICONS.streak}
              value="5 araw"
              label="Sunod-sunod na pagbasa"
              bg="var(--talas-buttercream)"
              color="var(--talas-yellow-dark)"
            />
            <StatCard
              icon={DASHBOARD_ICONS.award}
              value="3 badge"
              label="Mga nakamit"
              bg="var(--talas-sky)"
              color="var(--talas-blue)"
            />
            {interventionPlan && (
              <StatCard
                icon={DASHBOARD_ICONS.shield}
                value={
                  interventionAveragePercent !== null
                    ? `${interventionAveragePercent}%`
                    : `${completedInterventionActivities}/${totalInterventionActivities}`
                }
                label="Hiwalay na Iskor sa Interbensyon"
                bg="var(--talas-yellow-soft)"
                color="var(--talas-yellow-dark)"
              />
            )}
          </div>
        </div>

        {/* ───────── WORK CARDS (existing tasks remain untouched) ───────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
            alignItems: 'stretch',
          }}
        >
          {/* Assigned work */}
          <section
            style={{
            background: 'white',
              borderRadius: '14px',
            border: '1px solid var(--talas-line)',
            padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--talas-yellow-dark)',
                }}
              >
                 Nakatalagang Gawain
              </span>
            </div>

            <div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--talas-charcoal)',
                }}
              >
                Pasalitang Pagbasa
              </div>
              <div style={{ fontFamily: FONT_READ, fontSize: '14px', color: 'var(--talas-muted)', marginTop: '4px' }}>
                {readingTitle ?? mockAssignment.title}
              </div>
              {readingTitle && automaticLevel && (
                <div
                  style={{
                    display: 'block',
                    marginTop: '6px',
                    color: 'var(--talas-muted)',
                    fontFamily: FONT_UI,
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  Awtomatikong Antas {automaticLevel}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onStartAssessment}
              disabled={assessmentLocked}
              style={{
                marginTop: 'auto',
                width: '100%',
                minHeight: '48px',
                background: 'var(--talas-green)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontFamily: FONT_UI,
                fontSize: '14px',
                fontWeight: 700,
                cursor: assessmentLocked ? 'not-allowed' : 'pointer',
                opacity: assessmentLocked ? 0.65 : 1,
              }}
            >
              {assessmentLocked ? 'Natapos na ang Pagsusuri' : 'Simulan Na!'}
            </button>
          </section>

          {/* Teacher-assigned intervention plan */}
          <section
            style={{
              background: 'white',
              borderRadius: '14px',
              border: '1px solid var(--talas-line)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: '20px', fontWeight: 700, color: 'var(--talas-charcoal)' }}>
                Intervention Plans
              </div>
              <div style={{ fontFamily: FONT_READ, fontSize: '13px', color: 'var(--talas-muted)' }}>
                Mga gawaing itinalaga ng iyong guro.
              </div>
            </div>
            {interventionPlan && totalInterventionActivities > 0 ? (
              <>
                <span style={{ color: 'var(--talas-muted)', fontFamily: FONT_UI, fontSize: '12px', fontWeight: 700 }}>
                  {completedInterventionActivities}/{totalInterventionActivities} natapos · {pendingInterventionActivities} natitira
                </span>
                {interventionPlan.activities.map((act) => (
                  <button key={act.id} type="button" onClick={() => onStartIntervention?.(act.id)} style={{ width: '100%', minHeight: '42px', padding: '8px 12px', border: '1px solid var(--talas-line)', borderRadius: '10px', background: 'white', color: 'var(--talas-charcoal)', fontFamily: FONT_UI, fontSize: '13px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                    {act.title} {act.result ? '· Natapos' : '· Simulan'}
                  </button>
                ))}
              </>
            ) : (
              <div style={{ fontFamily: FONT_READ, fontSize: '14px', color: 'var(--talas-muted)', padding: '8px 0' }}>
                Wala pang nakatalagang intervention plan.
              </div>
            )}
          </section>
        </div>

        {/* ───────── PROFILE CARD ───────── */}
        <button
          type="button"
          onClick={onGoToProfile}
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '18px 22px',
            border: '1px solid var(--talas-blue-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <FrogMascot size={52} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--talas-charcoal)',
              }}
            >
              Aking Profile sa Pagbabasa
            </div>
            <div style={{ fontFamily: FONT_READ, fontSize: '13px', color: 'var(--talas-muted)', marginTop: '2px' }}>
              Tingnan ang iyong mga nagawa at progreso
            </div>
          </div>
          <span style={{ fontFamily: FONT_UI, fontSize: '22px', color: 'var(--talas-green)' }}>→</span>
        </button>
      </div>
    </div>
  )
}
