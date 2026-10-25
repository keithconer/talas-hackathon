/** A single activity inside an intervention. */
export interface InterventionActivity {
  id: string
  title: string
  description: string
  completed: boolean
}

/** An intervention assigned to a learner following a review. */
export interface Intervention {
  id: string
  learnerId: string
  /** The assessment that triggered this intervention, if any. */
  assessmentId?: string
  title: string
  rationale: string
  activities: InterventionActivity[]
  /** ISO date string. */
  createdAt: string
}
