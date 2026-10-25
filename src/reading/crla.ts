/**
 * TALAS — CRLA grading (single source of truth).
 *
 * Encodes the DepEd Comprehensive Rapid Literacy Assessment (CRLA) Grades 2–3
 * oral-reading proficiency structure. A learner is graded on TWO dimensions and
 * placed into one of four profiles:
 *
 *   GR — Grade Ready
 *   LR — Light Refresher
 *   MR — Moderate Refresher
 *   FR — Full Refresher
 *
 * The two dimensions are:
 *   1. Oral reading ACCURACY — percent of the passage read correctly.
 *   2. Reading COMPREHENSION  — number of comprehension questions answered
 *      correctly (out of the number asked, standard CRLA uses 5).
 *
 * CRLA combines them by taking the LOWER of the two sub-levels: a learner who
 * decodes fluently but understands little is NOT "Grade Ready". When only one
 * dimension is available (e.g. an oral attempt with no comprehension quiz yet),
 * grading falls back to that single dimension.
 *
 * NOTE ON CUTOFFS: these reflect the standard CRLA structure (accuracy bands
 * and comprehension-count bands mapped to the four profiles). The exact DepEd
 * per-grade / per-window (BoSY/MoSY/EoSY) numbers vary; adjust the constants
 * below if an official per-grade scoresheet is supplied.
 */

/** The four CRLA profiles, ordered weakest → strongest. */
export type CrlaProfile = 'FR' | 'MR' | 'LR' | 'GR'

/** Ascending severity order used to take the LOWER (weaker) of two levels. */
const PROFILE_ORDER: CrlaProfile[] = ['FR', 'MR', 'LR', 'GR']

/** Rank of a profile (0 = Full Refresher … 3 = Grade Ready). */
export function profileRank(p: CrlaProfile): number {
  return PROFILE_ORDER.indexOf(p)
}

/** Returns the LOWER (weaker) of two profiles — how CRLA combines sub-scores. */
export function lowerProfile(a: CrlaProfile, b: CrlaProfile): CrlaProfile {
  return profileRank(a) <= profileRank(b) ? a : b
}

/* ------------------------------------------------------------------ */
/* Dimension 1: oral reading accuracy (% of passage read correctly)    */
/* ------------------------------------------------------------------ */

/**
 * Accuracy thresholds (inclusive lower bounds), strongest first. A reader at
 * or above a threshold earns that profile.
 *
 *   ≥ 95%  → Grade Ready
 *   ≥ 90%  → Light Refresher
 *   ≥ 75%  → Moderate Refresher
 *   < 75%  → Full Refresher
 */
export const ACCURACY_THRESHOLDS = {
  GR: 95,
  LR: 90,
  MR: 75,
} as const

/** Maps an oral-reading accuracy percent (0–100) to a CRLA profile. */
export function profileFromAccuracy(accuracyPct: number): CrlaProfile {
  if (accuracyPct >= ACCURACY_THRESHOLDS.GR) return 'GR'
  if (accuracyPct >= ACCURACY_THRESHOLDS.LR) return 'LR'
  if (accuracyPct >= ACCURACY_THRESHOLDS.MR) return 'MR'
  return 'FR'
}

/* ------------------------------------------------------------------ */
/* Dimension 2: reading comprehension (questions correct)              */
/* ------------------------------------------------------------------ */

/** Standard CRLA comprehension set size. */
export const COMPREHENSION_TOTAL = 5

/**
 * Comprehension thresholds as a fraction (correct / total), strongest first.
 * Mapped so that, out of 5 questions:
 *
 *   4–5 correct (≥ 0.8) → Grade Ready
 *   3   correct (≥ 0.6) → Light Refresher
 *   2   correct (≥ 0.4) → Moderate Refresher
 *   0–1 correct (< 0.4) → Full Refresher
 */
export const COMPREHENSION_FRACTIONS = {
  GR: 0.8,
  LR: 0.6,
  MR: 0.4,
} as const

/** Maps comprehension (correct of total) to a CRLA profile. */
export function profileFromComprehension(
  correct: number,
  total: number = COMPREHENSION_TOTAL,
): CrlaProfile {
  const frac = total > 0 ? correct / total : 0
  if (frac >= COMPREHENSION_FRACTIONS.GR) return 'GR'
  if (frac >= COMPREHENSION_FRACTIONS.LR) return 'LR'
  if (frac >= COMPREHENSION_FRACTIONS.MR) return 'MR'
  return 'FR'
}

/* ------------------------------------------------------------------ */
/* Combined grade                                                      */
/* ------------------------------------------------------------------ */

export interface ComprehensionInput {
  correct: number
  total?: number
}

/**
 * Grades a learner against the CRLA standard.
 *
 * - Both dimensions present → the LOWER of the accuracy level and the
 *   comprehension level (the real CRLA rule).
 * - Only accuracy present    → graded on accuracy alone.
 * - Only comprehension present → graded on comprehension alone.
 *
 * Returns the final profile plus the two sub-profiles for transparency in the
 * teacher UI.
 */
export function gradeCrla(
  accuracyPct: number | null,
  comprehension?: ComprehensionInput | null,
): {
  level: CrlaProfile
  accuracyLevel: CrlaProfile | null
  comprehensionLevel: CrlaProfile | null
  basis: 'both' | 'accuracy' | 'comprehension'
} {
  const accuracyLevel =
    accuracyPct == null ? null : profileFromAccuracy(accuracyPct)
  const comprehensionLevel =
    comprehension == null
      ? null
      : profileFromComprehension(comprehension.correct, comprehension.total)

  if (accuracyLevel != null && comprehensionLevel != null) {
    return {
      level: lowerProfile(accuracyLevel, comprehensionLevel),
      accuracyLevel,
      comprehensionLevel,
      basis: 'both',
    }
  }
  if (accuracyLevel != null) {
    return { level: accuracyLevel, accuracyLevel, comprehensionLevel: null, basis: 'accuracy' }
  }
  if (comprehensionLevel != null) {
    return { level: comprehensionLevel, accuracyLevel: null, comprehensionLevel, basis: 'comprehension' }
  }
  // No data at all — default to the weakest profile.
  return { level: 'FR', accuracyLevel: null, comprehensionLevel: null, basis: 'accuracy' }
}

/* ------------------------------------------------------------------ */
/* Labels + learner-facing copy                                        */
/* ------------------------------------------------------------------ */

export const CRLA_PROFILE_LABEL: Record<CrlaProfile, string> = {
  GR: 'Grade Ready',
  LR: 'Light Refresher',
  MR: 'Moderate Refresher',
  FR: 'Full Refresher',
}

/** Learner-facing tone + Filipino encouragement, aligned to CRLA accuracy. */
export function accuracyEncouragement(accuracyPct: number): {
  tone: 'strong' | 'ok' | 'weak'
  label: string
} {
  const level = profileFromAccuracy(accuracyPct)
  if (level === 'GR') return { tone: 'strong', label: 'Mahusay!' }
  if (level === 'LR' || level === 'MR')
    return { tone: 'ok', label: 'Magaling, ituloy mo lang!' }
  return { tone: 'weak', label: 'Subukan nating muli.' }
}
