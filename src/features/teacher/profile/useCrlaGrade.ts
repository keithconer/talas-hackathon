import { useReadingAttempts } from './useReadingAttempts'
import {
  gradeCrla,
  profileFromAccuracy,
  CRLA_PROFILE_LABEL,
  type CrlaProfile,
} from '../../../reading/crla'
import type { ReadingAttempt } from '../../../data'

export interface CrlaGrade {
  /** True once the learner has at least one submitted reading attempt. */
  assessed: boolean
  /** Final CRLA profile from the learner's best submission (null if none). */
  level: CrlaProfile | null
  /** Short label, e.g. "Light Refresher". */
  label: string | null
  /** Best oral-reading accuracy across submissions (0–100), or null. */
  bestAccuracy: number | null
  /** The attempt that produced the best accuracy (the grading evidence). */
  bestAttempt: ReadingAttempt | null
  /** All submissions, newest first. */
  attempts: ReadingAttempt[]
  loading: boolean
}

/**
 * Derives a learner's CRLA proficiency grade from their REAL submitted reading
 * attempts (not the static roster). The grade is based on the learner's BEST
 * oral-reading accuracy, mapped through the CRLA standard (reading/crla.ts).
 *
 * This is the single hook the teacher profile uses so the identity header, the
 * Formal Assessment Snapshot, and the dashboard all agree.
 */
export function useCrlaGrade(learnerId: string | undefined): CrlaGrade {
  const { attempts, loading } = useReadingAttempts(learnerId)

  if (attempts.length === 0) {
    return {
      assessed: false,
      level: null,
      label: null,
      bestAccuracy: null,
      bestAttempt: null,
      attempts,
      loading,
    }
  }

  const bestAttempt = attempts.reduce((best, a) =>
    a.accuracy > best.accuracy ? a : best,
  )
  const bestAccuracy = bestAttempt.accuracy

  // Grade on oral accuracy. (When comprehension-question results are persisted
  // onto an attempt, pass them here as the second argument so gradeCrla takes
  // the lower of the two sub-levels per the CRLA rule.)
  const { level } = gradeCrla(bestAccuracy)

  return {
    assessed: true,
    level,
    label: CRLA_PROFILE_LABEL[level],
    bestAccuracy,
    bestAttempt,
    attempts,
    loading,
  }
}

/** Tailwind chip classes for a CRLA level badge. */
export function crlaBadgeClasses(level: CrlaProfile | null): string {
  switch (level) {
    case 'GR':
      return 'bg-crla-gr/15 text-crla-gr'
    case 'LR':
      return 'bg-crla-lr/20 text-charcoal'
    case 'MR':
      return 'bg-crla-mr/15 text-crla-mr'
    case 'FR':
      return 'bg-crla-fr/15 text-crla-fr'
    default:
      return 'bg-gray-100 text-gray-400'
  }
}

export { profileFromAccuracy }
