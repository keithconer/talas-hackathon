import { useEffect, useState } from 'react'
import LearnerAuth from '../auth/LearnerAuth'
import LearnerDashboard from '../../screens/learner/LearnerDashboard'
import OralAssessment from '../../screens/learner/OralAssessment'
import OralCompletion from '../../screens/learner/OralCompletion'
import SilentAssessment from '../../screens/learner/SilentAssessment'
import FormalAssessmentCompletion from '../../screens/learner/FormalAssessmentCompletion'
import PracticeActivity from '../../screens/learner/practice/PracticeActivity'
import PracticeCompletion from '../../screens/learner/PracticeCompletion'
import LearnerProfile from '../../screens/learner/LearnerProfile'
import PicturePractice from '../../screens/learner/practice/PicturePractice'
import LearnerInterventionScreen from '../../screens/learner/LearnerInterventionScreen'
import {
  getNextPracticeActivity,
  updatePracticeLevel,
} from '../../data/practiceData'
import type {
  PracticeProfile,
  PracticeActivityDef,
} from '../../data/practiceData'
import {
  setLearnerInactive,
  type LearnerRecord,
} from '../teacher/dashboard/sectionData'
import type { OralResult } from '../../screens/learner/OralAssessment'
import {
  listInterventionPlansByLearner,
  listReadingAttemptsByLearner,
  listSilentAttemptsByLearner,
  listPictureAttemptsByLearner,
  listAssignmentsByLearner,
  syncNow,
  type InterventionPlan,
} from '../../data'
import {
  mixedReadingForLevel,
  readingLevelFromAccuracy,
  type BankActivity,
} from '../../data/contentBank'

/**
 * Learner experience, mounted at `/learner` from Oliver's router. This hosts
 * the real reading-assessment flow (speech recognition, scoring, timestamps,
 * S3 recording upload, IndexedDB persistence). The first app page is still
 * Oliver's RoleSelector at `/`; picking "I'm a Learner" routes here.
 *
 * Internally this is a simple screen switch (not nested routes), which keeps
 * the self-contained assessment flow intact as it was built and tested.
 */
type Screen =
  | 'dashboard'
  | 'oral-assessment'
  | 'oral-completion'
  | 'silent-assessment'
  | 'formal-completion'
  | 'practice-activity'
  | 'practice-completion'
  | 'profile'
  | 'picture-practice'
  | 'intervention-activity'

export default function LearnerApp() {
  // The authenticated learner (null until a valid code is entered).
  const [learner, setLearner] = useState<LearnerRecord | null>(null)
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')
  const learnerName = learner?.name ?? 'Mag-aaral'
  const [practiceProfile, setPracticeProfile] = useState<PracticeProfile>({
    currentLevel: 2,
    recentScores: [],
    consecutiveHighScores: 0,
    consecutiveLowScores: 0,
    completedActivityIds: [],
  })
  const [practiceProfileReadyFor, setPracticeProfileReadyFor] = useState<string | null>(null)
  const [activeActivityId, setActiveActivityId] = useState<string>('')
  const [lastActivityTitle, setLastActivityTitle] = useState<string>('')
  const [lastScorePercent, setLastScorePercent] = useState<number>(0)
  const [, setOralResult] = useState<OralResult | null>(null)
  const [oralResultForView, setOralResultForView] = useState<OralResult | null>(
    null,
  )
  // The next reading is selected automatically from the learner's best synced
  // oral-reading accuracy. No teacher assignment is required.
  const [automaticActivity, setAutomaticActivity] = useState<BankActivity | null>(null)
  const [bestAccuracy, setBestAccuracy] = useState<number | null>(null)
  const [formalAssessmentLocked, setFormalAssessmentLocked] = useState(false)
  const [teacherAssignedAssessment, setTeacherAssignedAssessment] = useState(false)
  const [firstBadgeUnlocked, setFirstBadgeUnlocked] = useState(false)
  const [hasAnyCompletedActivity, setHasAnyCompletedActivity] = useState(false)

  // Separate Reading Intervention Plan state (never overwrites regular tasks or scores)
  const [interventionPlan, setInterventionPlan] = useState<InterventionPlan | null>(null)
  const [selectedInterventionActivityId, setSelectedInterventionActivityId] =
    useState<string | undefined>(undefined)

  useEffect(() => {
    if (!learner) return
    setPracticeProfileReadyFor(null)
    const key = `talas-practice-profile:${learner.id}`
    try {
      const saved = localStorage.getItem(key)
      if (saved) setPracticeProfile(JSON.parse(saved) as PracticeProfile)
    } catch {
      /* Keep the in-memory default if local storage is unavailable. */
    }
    setPracticeProfileReadyFor(learner.id)
  }, [learner])

  useEffect(() => {
    if (!learner || practiceProfileReadyFor !== learner.id) return
    try {
      localStorage.setItem(`talas-practice-profile:${learner.id}`, JSON.stringify(practiceProfile))
    } catch {
      /* Profile history remains available for this session. */
    }
  }, [learner, practiceProfile, practiceProfileReadyFor])

  // On login, sync and inspect the learner's prior readings + any assigned
  // Reading Intervention Plan. Regular tasks remain untouched.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!learner) {
        if (!cancelled) {
          setAutomaticActivity(null)
          setBestAccuracy(null)
          setInterventionPlan(null)
          setFormalAssessmentLocked(false)
          setTeacherAssignedAssessment(false)
          setHasAnyCompletedActivity(false)
          setFirstBadgeUnlocked(false)
        }
        return
      }
      try {
        await syncNow()
      } catch {
        /* offline — use locally stored attempts & plans */
      }
      const [attempts, plans, silentAttempts, assignments, pictureAttempts] = await Promise.all([
        listReadingAttemptsByLearner(learner.id),
        listInterventionPlansByLearner(learner.id),
        listSilentAttemptsByLearner(learner.id),
        listAssignmentsByLearner(learner.id),
        listPictureAttemptsByLearner(learner.id),
      ])
      let hasSavedPractice = false
      try {
        const savedPractice = localStorage.getItem(`talas-practice-profile:${learner.id}`)
        hasSavedPractice = Boolean(savedPractice && (JSON.parse(savedPractice) as PracticeProfile).completedActivityIds.length)
      } catch { /* Ignore unavailable or invalid local profile data. */ }
      const hasPreviousActivity = hasSavedPractice || attempts.length + silentAttempts.length + pictureAttempts.length + plans.flatMap((plan) => plan.activities).filter((act) => Boolean(act.result)).length > 0
      const hasSubmittedFormal = attempts.length > 0 || silentAttempts.some((attempt) => attempt.assessmentId === 'silent-ang-batang-magsasaka-v1')
      const hasTeacherAssignment = assignments.some((assignment) => assignment.assessmentId === 'silent-ang-batang-magsasaka-v1' && (assignment.status === 'assigned' || assignment.status === 'in-progress'))
      const best =
        attempts.length > 0
          ? Math.max(...attempts.map((a) => a.accuracy))
          : null
      if (cancelled) return

      // Pick the latest active/assigned plan (prefer Approved/In Progress, else newest)
      const activePlan =
        plans.find(
          (p) => p.status === 'Approved' || p.status === 'In Progress',
        ) ??
        plans[0] ??
        null
      setInterventionPlan(activePlan)
      setHasAnyCompletedActivity(hasPreviousActivity)
      setFormalAssessmentLocked(hasSubmittedFormal && !hasTeacherAssignment)
      setTeacherAssignedAssessment(hasTeacherAssignment)

      setBestAccuracy(best)
      if (best == null) {
        setAutomaticActivity(null)
        return
      }

      const level = readingLevelFromAccuracy(best)
      setAutomaticActivity(mixedReadingForLevel(level) ?? null)
      setPracticeProfile((profile) => ({ ...profile, currentLevel: level }))
    })()
    return () => {
      cancelled = true
    }
  }, [learner])

  const automaticPassageText = automaticActivity?.passage.join('\n\n')
  const automaticPassageId = automaticActivity?.id

  const handleStartPractice = () => {
    const act: PracticeActivityDef = getNextPracticeActivity(practiceProfile)
    setActiveActivityId(act.id)
    setLastActivityTitle(act.title)
    setCurrentScreen('practice-activity')
  }

  const handleActivityComplete = (scorePercent: number) => {
    const updated = updatePracticeLevel(
      practiceProfile,
      scorePercent,
      activeActivityId,
    )
    setPracticeProfile(updated)
    if (!hasAnyCompletedActivity) setFirstBadgeUnlocked(true)
    setHasAnyCompletedActivity(true)
    setLastScorePercent(scorePercent)
    setCurrentScreen('practice-completion')
  }

  // Salita at Larawan completion is recorded separately in `pictureAttempts`
  // and does not alter the learner's oral/silent reading practice profile.
  const handlePicturePracticeComplete = (scorePercent: number) => {
    if (!hasAnyCompletedActivity) setFirstBadgeUnlocked(true)
    setHasAnyCompletedActivity(true)
    setLastScorePercent(scorePercent)
    setCurrentScreen('practice-completion')
  }

  const handleKeepPracticing = () => {
    const act: PracticeActivityDef = getNextPracticeActivity(practiceProfile)
    setActiveActivityId(act.id)
    setLastActivityTitle(act.title)
    setCurrentScreen('practice-activity')
  }

  /** Sign the learner out: clear their active status and return to the gate. */
  const handleExit = () => {
    if (learner) setLearnerInactive(learner.id)
    setLearner(null)
    setCurrentScreen('dashboard')
  }

  // Code gate: no entry without a valid per-student code.
  if (!learner) {
    return <LearnerAuth onSuccess={setLearner} />
  }

  switch (currentScreen) {
    case 'dashboard':
      return (
        <LearnerDashboard
          learnerName={learnerName}
          onLogout={handleExit}
          readingTitle={automaticActivity?.title}
          automaticLevel={automaticActivity?.level}
          interventionPlan={interventionPlan}
          onStartIntervention={(activityId) => {
            setSelectedInterventionActivityId(activityId)
            setCurrentScreen('intervention-activity')
          }}
          onStartAssessment={() => { if (!formalAssessmentLocked) setCurrentScreen('oral-assessment') }}
          assessmentLocked={formalAssessmentLocked}
          onStartPractice={handleStartPractice}
          onStartPicturePractice={() => {
            setActiveActivityId('picture-word-practice')
            setLastActivityTitle('Salita at Larawan')
            setCurrentScreen('picture-practice')
          }}
          onGoToProfile={() => setCurrentScreen('profile')}
        />
      )
    case 'intervention-activity':
      return interventionPlan ? (
        <LearnerInterventionScreen
          learnerId={learner.id}
          learnerName={learnerName}
          plan={interventionPlan}
          firstActivity={!hasAnyCompletedActivity}
          onFirstActivityCompleted={() => {
            if (!hasAnyCompletedActivity) setFirstBadgeUnlocked(true)
            setHasAnyCompletedActivity(true)
          }}
          initialActivityId={selectedInterventionActivityId}
          onPlanUpdated={(updated) => setInterventionPlan(updated)}
          onBack={() => setCurrentScreen('dashboard')}
        />
      ) : (
        <LearnerDashboard
          learnerName={learnerName}
          onLogout={handleExit}
          readingTitle={automaticActivity?.title}
          automaticLevel={automaticActivity?.level}
          onStartAssessment={() => { if (!formalAssessmentLocked) setCurrentScreen('oral-assessment') }}
          assessmentLocked={formalAssessmentLocked}
          onStartPractice={handleStartPractice}
          onStartPicturePractice={() => {
            setActiveActivityId('picture-word-practice')
            setLastActivityTitle('Salita at Larawan')
            setCurrentScreen('picture-practice')
          }}
          onGoToProfile={() => setCurrentScreen('profile')}
        />
      )
    case 'oral-assessment':
      return (
        <OralAssessment
          learnerId={learner.id}
          passageText={automaticPassageText}
          passageId={automaticPassageId}
          onBack={() => setCurrentScreen('dashboard')}
          onSubmit={(result) => {
            setOralResult(result)
            setOralResultForView(result)
            setFormalAssessmentLocked(!teacherAssignedAssessment)
            if (!hasAnyCompletedActivity) setFirstBadgeUnlocked(true)
            setHasAnyCompletedActivity(true)

            // Recalculate immediately after every reading. The best result is
            // retained as the formal CRLA basis, and its accuracy determines
            // which Content Bank level the learner reads next.
            const nextBest = Math.max(bestAccuracy ?? 0, result.accuracy)
            const nextLevel = readingLevelFromAccuracy(nextBest)
            setBestAccuracy(nextBest)
            setAutomaticActivity(mixedReadingForLevel(nextLevel) ?? null)
            setPracticeProfile((profile) => ({ ...profile, currentLevel: nextLevel }))
            setCurrentScreen('oral-completion')
          }}
        />
      )
    case 'oral-completion':
      return (
        <OralCompletion
          result={oralResultForView}
          firstBadgeUnlocked={firstBadgeUnlocked}
          onContinue={() => { setFirstBadgeUnlocked(false); setCurrentScreen('silent-assessment') }}
        />
      )
    case 'silent-assessment':
      return (
        <SilentAssessment
          learnerId={learner.id}
          onComplete={() => setCurrentScreen('formal-completion')}
        />
      )
    case 'formal-completion':
      return (
        <FormalAssessmentCompletion
          learnerName={learnerName}
          onDone={() => setCurrentScreen('dashboard')}
        />
      )
    case 'picture-practice':
      return (
        <PicturePractice
          learnerId={learner.id}
          learnerName={learnerName}
          onBack={() => setCurrentScreen('dashboard')}
          onComplete={handlePicturePracticeComplete}
        />
      )
    case 'practice-activity':
      return (
        <PracticeActivity
          activityId={activeActivityId}
          onComplete={handleActivityComplete}
          onBack={() => setCurrentScreen('dashboard')}
        />
      )
    case 'practice-completion':
      return (
        <PracticeCompletion
          learnerName={learnerName}
          activityTitle={lastActivityTitle}
          scorePercent={lastScorePercent}
          firstBadgeUnlocked={firstBadgeUnlocked}
          onBadgeAcknowledged={() => setFirstBadgeUnlocked(false)}
          onKeepPracticing={activeActivityId === 'picture-word-practice' ? () => setCurrentScreen('picture-practice') : handleKeepPracticing}
          onBackToDashboard={() => setCurrentScreen('dashboard')}
        />
      )
    case 'profile':
      return (
        <LearnerProfile
          learnerName={learnerName}
          learnerId={learner.id}
          practiceProfile={practiceProfile}
          onBack={() => setCurrentScreen('dashboard')}
          onExit={handleExit}
        />
      )
    default:
      return null
  }
}
