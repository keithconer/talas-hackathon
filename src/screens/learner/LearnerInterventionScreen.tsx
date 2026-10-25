import { useEffect, useRef, useState } from 'react'
import { Check, Volume2 } from 'lucide-react'
import FrogMascot from '../../components/FrogMascot'
import {
  STORES,
  putRecord,
  syncNow,
  type InterventionCategory,
  type InterventionPlan,
  type InterventionPlanActivity,
} from '../../data'
import {
  recordActivityAutoGrade,
  updateInterventionPlanStatus,
} from '../../features/teacher/intervention/interventionEngine'

interface Props {
  learnerId: string
  learnerName: string
  plan: InterventionPlan
  initialActivityId?: string
  onPlanUpdated: (updated: InterventionPlan) => void
  firstActivity?: boolean
  onFirstActivityCompleted?: () => void
  onBack: () => void
}

const FONT_DISPLAY = "'Fredoka', system-ui, sans-serif"
const FONT_UI = "'Inter', system-ui, sans-serif"
const FONT_READ = "'Inter', system-ui, sans-serif"

/**
 * Bundled unedited Google Translate Filipino MP3 clips from Salita at Larawan
 * (`/audio/fil/google-whole-v2/*.mp3`).
 */
const BUNDLED_GOOGLE_WHOLE_V2_CLIPS = new Set([
  'mesa',
  'bola',
  'kama',
  'aklat',
  'upuan',
  'instructions',
  'mesa-meaning',
  'bola-meaning',
  'kama-meaning',
  'aklat-meaning',
  'upuan-meaning',
])

const CATEGORY_META: Record<
  InterventionCategory,
  { filipinoTitle: string }
> = {
  'Word Recognition': {
    filipinoTitle: 'Pagkilala ng Salita',
  },
  Marungko: {
    filipinoTitle: 'Marungko Approach',
  },
  'Letter Sounds': {
    filipinoTitle: 'Tunog ng Titik',
  },
  'Short Stories': {
    filipinoTitle: 'Maikling Kuwento',
  },
}

export default function LearnerInterventionScreen({
  learnerId,
  learnerName,
  plan,
  initialActivityId,
  onPlanUpdated,
  firstActivity = false,
  onFirstActivityCompleted,
  onBack,
}: Props) {
  const firstUnfinished =
    plan.activities.find((a) => !a.result)?.id ?? plan.activities[0]?.id ?? ''
  const [selectedActivityId, setSelectedActivityId] = useState<string>(firstUnfinished || initialActivityId || '')
  const [answersByActivity, setAnswersByActivity] = useState<
    Record<string, Record<string, string>>
  >(() => {
    const initial: Record<string, Record<string, string>> = {}
    for (const act of plan.activities) {
      if (act.result?.studentResponses) {
        initial[act.id] = { ...act.result.studentResponses }
      }
    }
    return initial
  })
  const [submitting, setSubmitting] = useState(false)
  const [justSubmittedId, setJustSubmittedId] = useState<string | null>(null)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)
  const [allPlanActivitiesDone, setAllPlanActivitiesDone] = useState(false)

  // Exact same HTMLAudioElement + Google Translate Filipino (tl) MP3 playback
  // pipeline used in Salita at Larawan (`PicturePractice.tsx`).
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const playbackId = useRef(0)
  const [audioVisible, setAudioVisible] = useState(false)
  const [audioMessage, setAudioMessage] = useState('')

  useEffect(() => {
    const audio = audioRef.current
    return () => {
      playbackId.current += 1
      audio?.pause()
    }
  }, [])

  function playFilipinoAudio(textOrClip: string) {
    const audio = audioRef.current
    if (!audio) return
    const cleaned = textOrClip.trim()
    if (!cleaned) return

    const currentPlayback = ++playbackId.current
    audio.pause()

    const normalizedKey = cleaned.toLowerCase()
    if (BUNDLED_GOOGLE_WHOLE_V2_CLIPS.has(normalizedKey)) {
      audio.src = `/audio/fil/google-whole-v2/${normalizedKey}.mp3`
    } else {
      audio.src = `/api/tts-fil?q=${encodeURIComponent(cleaned)}`
    }

    setAudioVisible(true)
    setAudioMessage('Inihahanda ang audio…')
    // Start inside the click event so browser autoplay restrictions are respected.
    void audio.play().catch(() => {
      if (currentPlayback === playbackId.current) {
        setAudioMessage(
          'Hindi nagsimula ang audio. Pindutin ang play sa audio player sa ibaba upang subukan muli.',
        )
      }
    })
  }

  const activeActivity: InterventionPlanActivity | undefined =
    plan.activities.find((a) => a.id === selectedActivityId) ??
    plan.activities[0]

  const currentAnswers = activeActivity
    ? (answersByActivity[activeActivity.id] ?? {})
    : {}

  const completedCount = plan.activities.filter((a) => Boolean(a.result)).length
  const totalActivities = plan.activities.length

  // Calculate separate intervention average across completed activities
  const completedWithScore = plan.activities.filter(
    (a) => a.result && a.result.maxScore > 0,
  )
  const interventionAveragePercent =
    completedWithScore.length > 0
      ? Math.round(
          completedWithScore.reduce(
            (sum, a) =>
              sum + (a.result!.finalScore / a.result!.maxScore) * 100,
            0,
          ) / completedWithScore.length,
        )
      : null

  const handleSelectChoice = (itemId: string, value: string) => {
    if (!activeActivity || activeActivity.result) return
    setAnswersByActivity((prev) => ({
      ...prev,
      [activeActivity.id]: {
        ...(prev[activeActivity.id] ?? {}),
        [itemId]: value,
      },
    }))
    setJustSubmittedId(null)
  }

  const handleSubmitActivity = async () => {
    if (!activeActivity || submitting) return
    setSubmitting(true)
    try {
      let updatedPlan = recordActivityAutoGrade(
        plan,
        activeActivity.id,
        currentAnswers,
        learnerId,
      )

      // Move plan status to In Progress when the learner begins submitting work
      if (
        updatedPlan.status === 'Draft' ||
        updatedPlan.status === 'Pending Review' ||
        updatedPlan.status === 'Approved'
      ) {
        updatedPlan = updateInterventionPlanStatus(
          updatedPlan,
          'In Progress',
          learnerId,
          `Sinimulan ni ${learnerName} ang gawaing interbensyon (${activeActivity.title}).`,
        )
      }

      const saved = await putRecord(STORES.interventionPlans, updatedPlan)
      onPlanUpdated(saved)
      onFirstActivityCompleted?.()
      setJustSubmittedId(activeActivity.id)
      setAllPlanActivitiesDone(saved.activities.every((activity) => Boolean(activity.result)))
      setShowSubmitSuccess(true)

      try {
        await syncNow()
      } catch {
        /* offline — synced automatically when back online */
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!activeActivity) {
    return (
      <div style={{ padding: 32, textAlign: 'center', fontFamily: FONT_UI }}>
        <p>Walang nakatalagang gawain sa plano ng interbensyon.</p>
        <button type="button" onClick={onBack}>
          Bumalik sa Dashboard
        </button>
      </div>
    )
  }

  const meta = CATEGORY_META[activeActivity.category]
  const ex = activeActivity.studentExercise
  const allQuestionsAnswered =
    ex.objectiveItems.length === 0 ||
    ex.objectiveItems.every(
      (item) => (currentAnswers[item.id] ?? '').trim().length > 0,
    )

  return (
    <div
      style={{
        minHeight: '100svh',
        background: 'var(--talas-paper)',
      }}
      lang="fil"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1040px',
          margin: '0 auto',
          padding: 'clamp(16px, 3vw, 28px) clamp(16px, 4vw, 40px) 56px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}
      >
        {/* ───────── TOP BAR ───────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => {
              playbackId.current += 1
              audioRef.current?.pause()
              onBack()
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'white',
              color: 'var(--talas-charcoal)',
              border: '1px solid var(--talas-line)',
              borderRadius: '10px',
              padding: '8px 16px',
              fontFamily: FONT_UI,
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Bumalik sa Dashboard
          </button>

          <span style={{ color: 'var(--talas-muted)', fontFamily: FONT_UI, fontSize: '12px' }}>
            Hiwalay na iskor sa interbensyon
          </span>
        </div>

        {/* ───────── HEADER BANNER ───────── */}
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: 'clamp(18px, 2.5vw, 26px)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '18px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '240px' }}>
            <FrogMascot size={74} />
            <div>
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--talas-yellow-dark)',
                }}
              >
                 Gabay sa Pagbasa (Baitang {plan.gradeLevel})
              </div>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 'clamp(20px, 2.6vw, 26px)',
                  fontWeight: 700,
                  color: 'var(--talas-charcoal)',
                  marginTop: '2px',
                }}
              >
                Plano ng Interbensyon ni {learnerName.split(' ')[0]}
              </div>
              <div
                style={{
                  fontFamily: FONT_READ,
                  fontSize: '14px',
                  color: 'var(--talas-muted)',
                  marginTop: '4px',
                }}
              >
                Iskedyul: {plan.schedule} · Natapos: {completedCount}/{totalActivities} gawain
              </div>
            </div>
          </div>

          {/* Separate Intervention Score Summary Box */}
          <div
            style={{
              background: 'var(--talas-yellow-soft)',
              border: '1px solid var(--talas-yellow)',
              borderRadius: '14px',
              padding: '14px 20px',
              textAlign: 'center',
              minWidth: '170px',
            }}
          >
            <div
              style={{
                fontFamily: FONT_UI,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--talas-yellow-dark)',
              }}
            >
              Iskor sa Interbensyon
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '26px',
                fontWeight: 700,
                color: 'var(--talas-yellow-dark)',
                marginTop: '2px',
              }}
            >
              {interventionAveragePercent !== null
                ? `${interventionAveragePercent}%`
                : '—'}
            </div>
            <div style={{ fontFamily: FONT_UI, fontSize: '11px', color: 'var(--talas-yellow-dark)' }}>
              Hiwalay sa Oral & Silent
            </div>
          </div>
        </div>

        {/* ───────── ACTIVITY TABS ───────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
          }}
        >
          {plan.activities.map((act, idx) => {
            const actMeta = CATEGORY_META[act.category]
            const isSelected = act.id === activeActivity.id
            const hasResult = Boolean(act.result)
            const pct =
              act.result && act.result.maxScore > 0
                ? Math.round((act.result.finalScore / act.result.maxScore) * 100)
                : null

            return (
              <button
                key={act.id}
                type="button"
                disabled={Boolean(act.result) || act.id !== firstUnfinished}
                onClick={() => {
                  playbackId.current += 1
                  audioRef.current?.pause()
                  setAudioVisible(false)
                  setAudioMessage('')
                  setSelectedActivityId(act.id)
                  setJustSubmittedId(null)
                }}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--talas-line)',
                  boxShadow: isSelected ? 'inset 0 0 0 1px var(--talas-green)' : 'none',
                  background: isSelected ? 'var(--talas-mint)' : 'white',
                  cursor: Boolean(act.result) || act.id !== firstUnfinished ? 'default' : 'pointer',
                  opacity: Boolean(act.result) || act.id !== firstUnfinished ? 0.68 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--talas-muted)',
                    }}
                  >
                    Gawain {idx + 1} · {actMeta.filipinoTitle}
                  </span>
                  {hasResult && (
                    <span
                      style={{
                        fontFamily: FONT_UI,
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--talas-blue-dark)',
                      }}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--talas-charcoal)',
                  }}
                >
                  {act.title}
                </div>
              </button>
            )
          })}
        </div>

        {/* ───────── ACTIVE ACTIVITY WORKSPACE ───────── */}
        <section
          style={{
            background: 'white',
            borderRadius: '14px',
            border: '1px solid var(--talas-line)',
            padding: 'clamp(20px, 3vw, 32px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '22px',
          }}
        >
          {/* Activity Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
              borderBottom: '1px solid #F3F4F6',
              paddingBottom: '16px',
            }}
          >
            <div>
              <span
                style={{
                  display: 'block',
                  color: 'var(--talas-muted)',
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {meta.filipinoTitle}
              </span>
              <h2
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 'clamp(20px, 2.5vw, 24px)',
                  fontWeight: 700,
                  color: 'var(--talas-charcoal)',
                  margin: '8px 0 4px',
                }}
              >
                {activeActivity.title}
              </h2>
              <p
                style={{
                  fontFamily: FONT_READ,
                  fontSize: '15px',
                  color: 'var(--talas-muted)',
                  margin: 0,
                }}
              >
                {ex.instructions}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                playFilipinoAudio(`${activeActivity.title}. ${ex.instructions}`)
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--talas-sky)',
                color: 'var(--talas-blue)',
                border: 'none',
                borderRadius: '14px',
                padding: '10px 16px',
                fontFamily: FONT_UI,
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Volume2 size={16} /> Pakinggan ang Panuto
            </button>
          </div>

          {/* Shared Salita-at-Larawan HTMLAudioElement + Status Notice */}
          <div
            style={{
              display: audioVisible || audioMessage ? 'flex' : 'none',
              flexDirection: 'column',
              gap: '6px',
              background: 'var(--talas-blue-soft)',
              border: '1px solid var(--talas-blue-soft)',
              borderRadius: '14px',
              padding: '10px 14px',
            }}
          >
            <audio
              ref={audioRef}
              controls
              hidden={!audioVisible}
              preload="none"
              aria-label="Audio sa Filipino"
              onPlaying={() =>
                setAudioMessage('Pinapakinggan ang audio sa Filipino…')
              }
              onEnded={() => setAudioMessage('')}
              onError={() =>
                setAudioMessage('Hindi ma-load ang audio. Pakisubukan muli.')
              }
              style={{ maxWidth: '100%' }}
            />
            {audioMessage && (
              <p
                role="status"
                style={{
                  margin: 0,
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--talas-blue-dark)',
                }}
              >
                {audioMessage}
              </p>
            )}
          </div>

          {/* Existing Result Banner (if already completed or reviewed by teacher) */}
          {activeActivity.result && (
            <div
              style={{
                background:
                  justSubmittedId === activeActivity.id ? 'var(--talas-blue-soft)' : 'var(--talas-yellow-soft)',
                border:
                  justSubmittedId === activeActivity.id
                    ? '2px solid var(--talas-blue)'
                    : '1px solid var(--talas-yellow)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--talas-blue-dark)',
                  }}
                >
                   Naitala ang Iyong Iskor sa Interbensyon:{' '}
                  {activeActivity.result.finalScore}/{activeActivity.result.maxScore} (
                  {Math.round(
                    (activeActivity.result.finalScore /
                      Math.max(1, activeActivity.result.maxScore)) *
                      100,
                  )}
                  %)
                </div>
                <div
                  style={{
                    fontFamily: FONT_READ,
                    fontSize: '13px',
                    color: '#374151',
                    marginTop: '4px',
                  }}
                >
                  {activeActivity.result.remarks}
                </div>
                {activeActivity.result.teacherComment && (
                  <div
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--talas-yellow-dark)',
                      marginTop: '6px',
                    }}
                  >
                    Komento ng guro: &ldquo;{activeActivity.result.teacherComment}&rdquo;
                  </div>
                )}
              </div>
              <span
                style={{
                  background: 'white',
                  color: 'var(--talas-blue-dark)',
                  border: '1px solid var(--talas-blue-soft)',
                  borderRadius: '10px',
                  padding: '5px 12px',
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {activeActivity.result.gradingMode === 'auto-graded'
                  ? 'Awtomatikong Naitala'
                  : activeActivity.result.gradingMode === 'teacher-corrected'
                    ? 'Inayos ng Guro'
                    : 'Sinuri ng Guro'}
              </span>
            </div>
          )}

          {/* Marungko Letters & Syllables */}
          {(ex.marungkoSequenceLetters?.length || ex.syllables?.length) && (
            <div
              style={{
                background: 'var(--talas-yellow-soft)',
                border: '1px solid var(--talas-yellow)',
                borderRadius: '14px',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {ex.marungkoSequenceLetters && ex.marungkoSequenceLetters.length > 0 && (
                <div>
                  <div
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--talas-yellow-dark)',
                      marginBottom: '8px',
                    }}
                  >
                     Mga Titik sa Marungko (Pindutin upang marinig)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {ex.marungkoSequenceLetters.map((letter) => (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => playFilipinoAudio(letter)}
                        style={{
                          minWidth: '54px',
                          height: '54px',
                          borderRadius: '14px',
                          border: '2px solid var(--talas-yellow)',
                          background: 'white',
                          fontFamily: FONT_DISPLAY,
                          fontSize: '22px',
                          fontWeight: 700,
                          color: 'var(--talas-yellow-dark)',
                          cursor: 'pointer',
                        }}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ex.syllables && ex.syllables.length > 0 && (
                <div>
                  <div
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: '12px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: 'var(--talas-yellow-dark)',
                      marginBottom: '8px',
                    }}
                  >
                     Mga Pantig (Basahin at Pakinggan)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {ex.syllables.map((syl) => (
                      <button
                        key={syl}
                        type="button"
                        onClick={() => playFilipinoAudio(syl)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '10px 18px',
                          borderRadius: '14px',
                          border: '1px solid var(--talas-yellow)',
                          background: 'white',
                          fontFamily: FONT_DISPLAY,
                          fontSize: '18px',
                          fontWeight: 700,
                          color: 'var(--talas-yellow-dark)',
                          cursor: 'pointer',
                        }}
                      >
                        <Volume2 size={15} /> {syl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Word List (interactive cards with Salita-at-Larawan audio) */}
          {ex.wordList && ex.wordList.length > 0 && (
            <div
              style={{
                background: 'var(--talas-paper)',
                border: '1px solid var(--talas-line)',
                borderRadius: '14px',
                padding: '18px',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_UI,
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--talas-green)',
                  marginBottom: '10px',
                }}
              >
                 Mga Salitang Pagsasanayan (Pindutin ang salita upang marinig)
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                  gap: '10px',
                }}
              >
                {ex.wordList.map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => playFilipinoAudio(word)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid var(--talas-blue-soft)',
                      background: 'white',
                      fontFamily: FONT_DISPLAY,
                      fontSize: '17px',
                      fontWeight: 700,
                      color: 'var(--talas-charcoal)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                    }}
                  >
                    <span>{word}</span>
                    <Volume2 size={16} color="var(--talas-green)" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Short Story Passage */}
          {ex.passageParagraphs && ex.passageParagraphs.length > 0 && (
            <div
              style={{
                background: 'var(--talas-blue-soft)',
                border: '2px solid var(--talas-blue-soft)',
                borderRadius: '14px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--talas-blue-dark)',
                  }}
                >
                   {ex.passageTitle || activeActivity.title}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    playFilipinoAudio(
                      `${ex.passageTitle ?? ''}. ${ex.passageParagraphs!.join(' ')}`,
                    )
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'white',
                    color: 'var(--talas-blue-dark)',
                    border: '1px solid var(--talas-blue-soft)',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontFamily: FONT_UI,
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Volume2 size={15} /> Pakinggan ang Kuwento
                </button>
              </div>
              {ex.passageParagraphs.map((para, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: FONT_READ,
                    fontSize: '18px',
                    lineHeight: 1.7,
                    color: '#1F2937',
                    margin: 0,
                  }}
                >
                  {para}
                </p>
              ))}

              {ex.vocabularyItems && ex.vocabularyItems.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '12px',
                    borderTop: '1px dashed var(--talas-blue-soft)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  {ex.vocabularyItems.map((v) => (
                    <button
                      key={v.word}
                      type="button"
                      onClick={() => playFilipinoAudio(`${v.word}. ${v.meaning}`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'white',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--talas-blue-soft)',
                        fontFamily: FONT_UI,
                        fontSize: '12px',
                        color: 'var(--talas-blue-dark)',
                        cursor: 'pointer',
                      }}
                    >
                      <Volume2 size={13} />
                      <span>
                        <strong>{v.word}:</strong> {v.meaning}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Objective Questions */}
          {ex.objectiveItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--talas-charcoal)',
                }}
              >
                 Sagutin ang mga Tanong ({ex.objectiveItems.length} tanong)
              </div>

              {ex.objectiveItems.map((item, qIdx) => {
                const chosen = currentAnswers[item.id] ?? ''
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--talas-paper)',
                      border: '1px solid var(--talas-line)',
                      borderRadius: '14px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: FONT_READ,
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--talas-charcoal)',
                        }}
                      >
                        {qIdx + 1}. {item.prompt}
                      </div>
                      <button
                        type="button"
                        onClick={() => playFilipinoAudio(item.prompt)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          background: 'white',
                          border: '1px solid var(--talas-line)',
                          borderRadius: '10px',
                          padding: '5px 12px',
                          fontFamily: FONT_UI,
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--talas-charcoal)',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Volume2 size={14} /> Pakinggan
                      </button>
                    </div>

                    {item.choices && item.choices.length > 0 ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '10px',
                        }}
                      >
                        {item.choices.map((choice) => {
                          const isPicked =
                            chosen.trim().toLowerCase() ===
                            choice.trim().toLowerCase()
                          return (
                            <button
                              key={choice}
                              type="button"
                              disabled={Boolean(activeActivity.result)}
                              onClick={() => handleSelectChoice(item.id, choice)}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '14px',
                                border: isPicked
                                  ? '2px solid var(--talas-green)'
                                  : '1px solid var(--talas-line)',
                                background: isPicked
                                  ? 'var(--talas-mint)'
                                  : 'white',
                                color: 'var(--talas-charcoal)',
                                fontFamily: FONT_UI,
                                fontSize: '15px',
                                fontWeight: isPicked ? 700 : 600,
                                cursor: 'pointer',
                                opacity: activeActivity.result ? 0.65 : 1,
                                textAlign: 'left',
                              }}
                            >
                              {isPicked && <Check size={16} aria-hidden="true" />}
                              {choice}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <input
                        type="text"
                        disabled={Boolean(activeActivity.result)}
                        value={chosen}
                        onChange={(e) =>
                          handleSelectChoice(item.id, e.target.value)
                        }
                        placeholder="I-type ang iyong sagot dito..."
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid var(--talas-line)',
                          fontFamily: FONT_UI,
                          fontSize: '15px',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Submit Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap',
              paddingTop: '8px',
            }}
          >
            <div style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'var(--talas-muted)' }}>
               Ang iskor sa gawaing ito ay itatala sa iyong{' '}
              <strong>Intervention Plan</strong> at hindi babaguhin ang iyong Oral o
              Silent Reading grade.
            </div>

            <button
              type="button"
              disabled={!allQuestionsAnswered || submitting || Boolean(activeActivity.result) || activeActivity.id !== firstUnfinished}
              onClick={() => void handleSubmitActivity()}
              style={{
                minHeight: '54px',
                padding: '0 28px',
                borderRadius: '16px',
                border: 'none',
                background: allQuestionsAnswered && !activeActivity.result && activeActivity.id === firstUnfinished
                  ? 'var(--talas-green)'
                  : 'var(--talas-line)',
                color: 'white',
                fontFamily: FONT_UI,
                fontSize: '16px',
                fontWeight: 700,
                cursor: allQuestionsAnswered && !activeActivity.result && activeActivity.id === firstUnfinished ? 'pointer' : 'not-allowed',
                boxShadow: allQuestionsAnswered && !activeActivity.result && activeActivity.id === firstUnfinished
                  ? '0 8px 18px -10px rgba(3,83,253,0.45)'
                  : 'none',
              }}
            >
              {submitting
                ? 'Itinatala ang Iskor...'
                : activeActivity.result
                  ? 'Naipasa na ang Gawain'
                  : 'Ipasa ang Gawain sa Interbensyon '}
            </button>
          </div>
        </section>
      </div>
      {showSubmitSuccess && (
        <div role="dialog" aria-modal="true" aria-labelledby="intervention-success-title" style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(20, 35, 30, 0.45)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(420px, 100%)', padding: 28, borderRadius: 20, background: 'white', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div aria-hidden="true" style={{ fontSize: 48 }}>🎉</div>
            <h2 id="intervention-success-title" style={{ fontFamily: FONT_DISPLAY, color: 'var(--talas-green)', fontSize: 24, margin: '8px 0' }}>{allPlanActivitiesDone ? 'Tapos na!' : firstActivity ? 'Na-unlock mo ang Unang Hakbang!' : 'Naipasa na!'}</h2>
            <p style={{ fontFamily: FONT_READ, color: 'var(--talas-charcoal)', margin: '0 0 20px' }}>{allPlanActivitiesDone ? `${firstActivity ? 'Na-unlock mo ang Unang Hakbang! ' : ''}Pwede ka nang magpahinga.` : firstActivity ? 'Naitala ang iyong unang gawain at badge sa iyong profile.' : 'Naitala na ang iyong sagot. Sunod naman ang susunod na gawain.'}</p>
            <button type="button" onClick={() => { setShowSubmitSuccess(false); if (allPlanActivitiesDone) onBack(); else { const next = plan.activities.find((act) => !act.result && act.id !== activeActivity.id); if (next) setSelectedActivityId(next.id) } }} style={{ minWidth: 140, minHeight: 46, border: 0, borderRadius: 12, background: 'var(--talas-green)', color: 'white', fontFamily: FONT_UI, fontWeight: 700, cursor: 'pointer' }}>Okay</button>
          </div>
        </div>
      )}
    </div>
  )
}
