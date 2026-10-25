import type { Difficulty } from './practice'

/** A single skill dimension tracked in the development profile. */
export interface SkillDimension {
  key: string
  label: string
  /** Normalized 0-100 score. */
  score: number
  level: Difficulty
}

/** A learner's overall development profile. */
export interface DevelopmentProfile {
  learnerId: string
  dimensions: SkillDimension[]
  /** Consecutive-day practice streak. */
  streak: number
  /** ISO date string of the last update. */
  updatedAt: string
}

/**
 * A locked, finalized snapshot of a learner's result for an assessment.
 * Rendered on the teacher's FormalSnapshot screen.
 */
export interface FormalSnapshot {
  id: string
  learnerId: string
  assessmentId: string
  summary: string
  dimensions: SkillDimension[]
  /** ISO date string when the snapshot was locked. */
  finalizedAt: string
}
