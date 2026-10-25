import { useEffect, useState } from 'react'
import { getAll, syncNow, type ReadingAttempt, type PictureAttempt, type SilentAttempt } from '../../../data'
import { LEARNERS } from './sectionData'

/** Only attempts belonging to a real roster learner are counted/shown. */
const ROSTER_IDS = new Set(LEARNERS.map((l) => l.id))

export interface SubmissionsIndex {
  /** Oral reading attempts grouped by learnerId (drives CRLA grades & oral stats). */
  byLearner: Record<string, ReadingAttempt[]>
  /** Learner ids that have at least one oral reading submission. */
  submittedIds: Set<string>
  /** Total oral reading submission count across all learners. */
  total: number
  /** Salita at Larawan attempts grouped by learnerId (kept separate from oral/silent grades). */
  pictureByLearner: Record<string, PictureAttempt[]>
  /** All live Salita at Larawan submissions across roster learners, newest first. */
  pictureAttempts: PictureAttempt[]
  /** Silent-reading comprehension submissions, newest first. */
  silentAttempts: SilentAttempt[]
}

const EMPTY: SubmissionsIndex = {
  byLearner: {},
  submittedIds: new Set(),
  total: 0,
  pictureByLearner: {},
  pictureAttempts: [],
  silentAttempts: [],
}

/**
 * Loads reading attempts and Salita at Larawan attempts from the data layer.
 * `byLearner` / `submittedIds` / `total` remain strictly Oral Reading attempts
 * so CRLA reading levels and oral/silent grades are never mixed with Salita at
 * Larawan scores. `pictureByLearner` and `pictureAttempts` expose Salita at
 * Larawan results separately for the teacher.
 */
export function useSubmissions(): SubmissionsIndex & { refresh: () => void } {
  const [index, setIndex] = useState<SubmissionsIndex>(EMPTY)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function readLocal() {
      const [allOral, allPicture, allSilent] = await Promise.all([
        getAll('readingAttempts'),
        getAll('pictureAttempts').catch(() => [] as PictureAttempt[]),
        getAll('silentAttempts').catch(() => [] as SilentAttempt[]),
      ])
      if (cancelled) return
      // Keep only live attempts that belong to a real roster learner — this
      // ignores stray test data (e.g. old 'learner-maria' seed attempts).
      const liveOral = allOral.filter(
        (a) => a.deleted !== true && ROSTER_IDS.has(a.learnerId),
      )
      const byLearner: Record<string, ReadingAttempt[]> = {}
      for (const a of liveOral) {
        ;(byLearner[a.learnerId] ??= []).push(a)
      }

      const livePicture = allPicture
        .filter((a) => a.deleted !== true && ROSTER_IDS.has(a.learnerId))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      const pictureByLearner: Record<string, PictureAttempt[]> = {}
      for (const a of livePicture) {
        ;(pictureByLearner[a.learnerId] ??= []).push(a)
      }

      const silentAttempts = allSilent
        .filter((a) => a.deleted !== true && ROSTER_IDS.has(a.learnerId))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

      setIndex({
        byLearner,
        submittedIds: new Set(Object.keys(byLearner)),
        total: liveOral.length,
        pictureByLearner,
        pictureAttempts: livePicture,
        silentAttempts,
      })
    }

    // Read local immediately, then sync in the background and re-read.
    void readLocal()
    void (async () => {
      try {
        await syncNow()
      } catch {
        /* offline / no endpoint — local data already shown */
      }
      if (!cancelled) await readLocal()
    })()

    return () => {
      cancelled = true
    }
  }, [tick])

  return { ...index, refresh: () => setTick((t) => t + 1) }
}
