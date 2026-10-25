/** Difficulty level for adaptive practice. */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

/** A practice activity the learner can attempt. */
export interface PracticeActivity {
  id: string
  title: string
  difficulty: Difficulty
  /** Short descriptor of the skill being practiced. */
  skill: string
}

/** A record of a learner's attempt at a practice activity. */
export interface PracticeAttempt {
  id: string
  learnerId: string
  activityId: string
  difficulty: Difficulty
  correct: boolean
  /** ISO date string. */
  attemptedAt: string
}
