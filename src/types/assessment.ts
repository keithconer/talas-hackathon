/**
 * Lifecycle status of an assessment assignment.
 * ASSIGNED -> IN_PROGRESS -> SUBMITTED -> REVIEWED -> FINALIZED
 */
export type AssessmentStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'FINALIZED'

/** A single question within an assessment. */
export interface AssessmentQuestion {
  id: string
  prompt: string
  /** Kind of response expected from the learner. */
  kind: 'oral' | 'silent'
}

/** A learner's answer to a single question. */
export interface QuestionResponse {
  questionId: string
  /** Text answer, if applicable. */
  text?: string
  /**
   * Reference to a recorded audio artifact. For the demo this is a local blob
   * URL; later it becomes an S3 object key once AWS storage lands.
   */
  recordingRef?: string
}

/** An assessment assigned to a specific learner. */
export interface AssessmentAssignment {
  id: string
  learnerId: string
  title: string
  status: AssessmentStatus
  questions: AssessmentQuestion[]
  responses: QuestionResponse[]
  /** ISO date string. */
  assignedAt: string
  /** ISO date string, set when the learner submits. */
  submittedAt?: string
  /** ISO date string, set when the teacher finalizes. */
  finalizedAt?: string
  /** Teacher's free-form review notes. */
  reviewNotes?: string
}
