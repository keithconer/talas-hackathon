import { useEffect, useState } from 'react'
import {
  listReadingAttemptsByLearner,
  listSilentAttemptsByLearner,
  listPictureAttemptsByLearner,
  listInterventionPlansByLearner,
  syncNow,
  type ReadingAttempt,
  type SilentAttempt,
  type PictureAttempt,
  type InterventionPlan,
} from '../../../data'

/**
 * Loads one learner's oral, silent, Salita at Larawan, and Reading Intervention
 * Plan records. Local IndexedDB is read immediately; cloud sync runs in the
 * background and all collections are then refreshed. Keeping Salita at Larawan
 * (`pictureAttempts`) and Reading Intervention Plans (`interventionPlans`) in
 * their own arrays ensures their grades are never mixed into oral or silent
 * reading calculations.
 */
export function useAssessmentAttempts(learnerId: string | undefined): {
  oralAttempts: ReadingAttempt[]
  silentAttempts: SilentAttempt[]
  pictureAttempts: PictureAttempt[]
  interventionPlans: InterventionPlan[]
  loading: boolean
  refresh: () => void
} {
  const [oralAttempts, setOralAttempts] = useState<ReadingAttempt[]>([])
  const [silentAttempts, setSilentAttempts] = useState<SilentAttempt[]>([])
  const [pictureAttempts, setPictureAttempts] = useState<PictureAttempt[]>([])
  const [interventionPlans, setInterventionPlans] = useState<InterventionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function readLocal() {
      if (!learnerId) {
        if (!cancelled) {
          setOralAttempts([])
          setSilentAttempts([])
          setPictureAttempts([])
          setInterventionPlans([])
          setLoading(false)
        }
        return
      }

      const [oral, silent, picture, plans] = await Promise.all([
        listReadingAttemptsByLearner(learnerId),
        listSilentAttemptsByLearner(learnerId),
        listPictureAttemptsByLearner(learnerId),
        listInterventionPlansByLearner(learnerId),
      ])
      if (!cancelled) {
        setOralAttempts(oral)
        setSilentAttempts(silent)
        setPictureAttempts(picture)
        setInterventionPlans(plans)
        setLoading(false)
      }
    }

    void readLocal()
    void (async () => {
      try {
        await syncNow()
      } catch {
        /* Offline: the immediate local read remains available. */
      }
      if (!cancelled) await readLocal()
    })()

    return () => {
      cancelled = true
    }
  }, [learnerId, tick])

  return {
    oralAttempts,
    silentAttempts,
    pictureAttempts,
    interventionPlans,
    loading,
    refresh: () => setTick((value) => value + 1),
  }
}
