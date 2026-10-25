/** A learner (student) in the TALAS system. */
export interface Learner {
  id: string
  name: string
  /** Short display initials or avatar seed, e.g. "MA". */
  avatarSeed?: string
  gradeLabel?: string
  /** ISO date string for when the learner record was created. */
  createdAt: string
}
