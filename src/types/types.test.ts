import { describe, it, expect } from 'vitest'
import type {
  Learner,
  AssessmentAssignment,
  Intervention,
  PracticeAttempt,
  DevelopmentProfile,
} from './index'

describe('shared types', () => {
  it('allow constructing representative domain objects', () => {
    const learner: Learner = {
      id: 'l1',
      name: 'Maria',
      createdAt: new Date().toISOString(),
    }

    const assignment: AssessmentAssignment = {
      id: 'a1',
      learnerId: learner.id,
      title: 'Reading check',
      status: 'ASSIGNED',
      questions: [{ id: 'q1', prompt: 'Read aloud', kind: 'oral' }],
      responses: [],
      assignedAt: new Date().toISOString(),
    }

    const intervention: Intervention = {
      id: 'i1',
      learnerId: learner.id,
      title: 'Phonics boost',
      rationale: 'Struggled with blends',
      activities: [
        { id: 'act1', title: 'Blend drill', description: '...', completed: false },
      ],
      createdAt: new Date().toISOString(),
    }

    const attempt: PracticeAttempt = {
      id: 'p1',
      learnerId: learner.id,
      activityId: 'pa1',
      difficulty: 'EASY',
      correct: true,
      attemptedAt: new Date().toISOString(),
    }

    const profile: DevelopmentProfile = {
      learnerId: learner.id,
      dimensions: [
        { key: 'fluency', label: 'Fluency', score: 72, level: 'MEDIUM' },
      ],
      streak: 3,
      updatedAt: new Date().toISOString(),
    }

    expect(assignment.status).toBe('ASSIGNED')
    expect(intervention.activities).toHaveLength(1)
    expect(attempt.correct).toBe(true)
    expect(profile.dimensions[0].level).toBe('MEDIUM')
  })
})
