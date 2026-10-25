/**
 * TALAS — minimal domain contracts (Hour 1 Foundation + Reading Intervention).
 *
 * Everything is persisted locally in IndexedDB (see `db.ts`). IDs are plain
 * strings so stores can be seeded deterministically.
 */

/** ISO-8601 timestamp, e.g. "2026-10-03T09:00:00.000Z". */
export type ISODateString = string;

/**
 * Sync bookkeeping mixed into every persisted entity. All fields are optional
 * so existing/seed data stays valid, but the repository layer (see
 * `repository.ts`) always stamps `updatedAt` and `dirty` on write.
 */
export interface SyncMeta {
  updatedAt?: ISODateString;
  dirty?: boolean;
  deleted?: boolean;
  syncedAt?: ISODateString;
}

/** A person who learns. Shown in the teacher dashboard and has a profile page. */
export interface Learner extends SyncMeta {
  id: string;
  name: string;
  /** Short handle / preferred name used in compact UI. */
  displayName?: string;
  /** Optional initials for avatar badges. */
  initials?: string;
  /** Optional section identifier (e.g. "sampaguita", "rosal", "mabini"). */
  sectionId?: string;
  /** Optional CRLA reading profile code ("FR" | "MR" | "LR" | "GR" | null). */
  level?: string | null;
  /** Optional status label. */
  status?: string;
  /** Optional avatar URL or asset path. */
  avatarUrl?: string;
  /** Grade band or cohort label, free-form for now (e.g. "Grade 7"). */
  grade?: string;
  createdAt: ISODateString;
}

/** A teacher owns learners and assigns assessments. */
export interface Teacher extends SyncMeta {
  id: string;
  name: string;
  email?: string;
  createdAt: ISODateString;
}

/** Question types supported by the minimal assessment engine. */
export type QuestionType = "multiple-choice" | "short-answer";

export interface Question {
  id: string;
  prompt: string;
  type: QuestionType;
  /** Present for multiple-choice questions. */
  choices?: string[];
  /** Index into `choices` (multiple-choice) or expected text (short-answer). */
  answer?: number | string;
  /** Points this question is worth. Defaults to 1 if omitted. */
  points?: number;
}

/** A reusable assessment definition (a quiz / test template). */
export interface Assessment extends SyncMeta {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  questions: Question[];
  createdAt: ISODateString;
}

/** Lifecycle of an assignment given to a specific learner. */
export type AssignmentStatus =
  | "assigned"
  | "in-progress"
  | "submitted"
  | "graded";

/**
 * An Assessment handed to a Learner. This is the join between a learner and an
 * assessment, plus the learner's progress/score for that attempt.
 */
export interface Assignment extends SyncMeta {
  id: string;
  assessmentId: string;
  learnerId: string;
  assignedBy: string; // teacher id
  status: AssignmentStatus;
  assignedAt: ISODateString;
  dueAt?: ISODateString;
  /** Learner answers keyed by question id. */
  responses?: Record<string, number | string>;
  /** 0–100 once graded. */
  score?: number;
  completedAt?: ISODateString;
}

/** Reading difficulty bands used by passages and adaptive practice. */
export type ReadingLevel = "antas-1" | "antas-2" | "antas-3";

/**
 * A short reading passage (Filipino short story) a learner reads aloud during
 * an oral reading assessment. `body` is the full text; `wordCount` is derived
 * and cached for quick scoring/UI.
 */
export interface ReadingPassage extends SyncMeta {
  id: string;
  title: string;
  /** Full passage text in Filipino. */
  body: string;
  level: ReadingLevel;
  /** Precomputed word count (whitespace-split). */
  wordCount: number;
  createdAt: ISODateString;
}

/** Per-word match outcome from comparing recognized speech to the passage. */
export interface WordResult {
  /** Index of the word in the passage (0-based). */
  index: number;
  /** The expected word (normalized for display is done in UI). */
  expected: string;
  /** True if the learner's speech matched this word. */
  correct: boolean;
  /**
   * Index of the spoken word that matched this passage word (-1 if the word was
   * skipped/not read). Used to attach the exact recognizer timing.
   */
  spokenIndex?: number;
  /**
   * Exact time (seconds from the start of the recording) when the learner said
   * this word, captured live from the recording clock. Used by the review UI to
   * seek the audio to the precise moment the word was read.
   */
  timeSec?: number;
}

/**
 * A learner's attempt at reading a passage aloud.
 */
export interface ReadingAttempt extends SyncMeta {
  id: string;
  passageId: string;
  learnerId: string;
  /** Raw transcript of what the recognizer (or learner) produced. */
  transcript: string;
  /** 0–100 reading accuracy = correctWords / totalWords. */
  accuracy: number;
  correctWords: number;
  totalWords: number;
  /** Per-word breakdown for teacher review and UI highlighting. */
  words: WordResult[];
  /** How the transcript was captured. */
  method: "speech-api" | "manual";
  /** Whether the device was online when the attempt was scored. */
  online: boolean;
  /** Seconds of recorded audio, if captured. */
  durationSec?: number;
  /** S3 object key of the uploaded voice recording. */
  audioKey?: string;
  createdAt: ISODateString;
}

/** One locked answer captured during a silent-reading assessment. */
export interface SilentQuestionResponse {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  /** Seconds elapsed before the learner selected this answer. */
  durationSec: number;
}

/**
 * A learner's silent-reading comprehension attempt.
 */
export interface SilentAttempt extends SyncMeta {
  id: string;
  learnerId: string;
  assessmentId: string;
  title: string;
  correctAnswers: number;
  totalQuestions: number;
  /** 0–100 comprehension score. */
  scorePercent: number;
  responses: SilentQuestionResponse[];
  durationSec: number;
  online: boolean;
  createdAt: ISODateString;
}

/** One locked answer captured during Salita at Larawan (picture-word matching). */
export interface PictureQuestionResponse {
  word: string;
  selected: string;
  correct: boolean;
}

/**
 * A learner's Salita at Larawan (picture-word matching) attempt. Kept in its
 * own store so its grades/scores are completely separate from oral and silent
 * reading assessments.
 */
export interface PictureAttempt extends SyncMeta {
  id: string;
  learnerId: string;
  activityId: string;
  title: string;
  correctAnswers: number;
  totalQuestions: number;
  /** 0–100 Salita at Larawan score (separate from oral & silent reading). */
  scorePercent: number;
  responses: PictureQuestionResponse[];
  online: boolean;
  createdAt: ISODateString;
}

/* ========================================================================== */
/* Student Reading Intervention System (Grades 1–3)                           */
/* ========================================================================== */

/**
 * Teacher-recorded Reading Intervention Screening assessment.
 * Default scale is 0–20 where scores 0–16 inclusive trigger intervention
 * eligibility (`usesZeroToSixteenThreshold: true`).
 */
export interface ScreeningAssessment extends SyncMeta {
  id: string;
  learnerId: string;
  sectionId?: string;
  grade?: string;
  assessmentName: string;
  /** Earned score on the screening assessment (null if ungraded). */
  score: number | null;
  /** Maximum possible score (standard screening = 20). */
  maxScore: number;
  /** True when the 0–16 inclusive intervention threshold applies to this assessment. */
  usesZeroToSixteenThreshold: boolean;
  /** Optional oral reading sub-score or observation notes. */
  oralReadingNotes?: string;
  remarks?: string;
  assessedBy: string;
  createdAt: ISODateString;
}

export type InterventionCategory =
  | "Word Recognition"
  | "Marungko"
  | "Letter Sounds"
  | "Short Stories";

export type InterventionPlanStatus =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "In Progress"
  | "Completed";

export type MaterialSourceAttribution =
  | "existing-deped-material"
  | "ai-generated-supplementary"
  | "ai-questions-from-deped-resource";

export type GradingMode =
  | "auto-graded"
  | "teacher-reviewed"
  | "teacher-corrected";

/** Reference snapshot of an assessment record used as evidence for a plan. */
export interface InterventionAssessmentRef {
  id: string;
  kind: "screening" | "oral" | "silent" | "picture";
  title: string;
  date: ISODateString;
  score: number;
  maxScore: number;
  usesZeroToSixteenThreshold: boolean;
  eligibleTrigger: boolean;
  remarks: string;
}

/** Objective exercise item that supports automatic grading when an answer key exists. */
export interface InterventionObjectiveItem {
  id: string;
  prompt: string;
  choices?: string[];
  answerKey: string;
  points: number;
}

/** Recorded result for an intervention activity (auto-graded or teacher-reviewed/corrected). */
export interface InterventionActivityResult {
  completedAt: ISODateString;
  studentResponses?: Record<string, string>;
  autoCalculatedScore?: number;
  finalScore: number;
  maxScore: number;
  gradingMode: GradingMode;
  remarks: string;
  teacherComment?: string;
  reviewedBy?: string;
}

/** A recommended & generated activity inside an InterventionPlan. */
export interface InterventionPlanActivity {
  id: string;
  title: string;
  category: InterventionCategory;
  skillGapAddressed: string;
  reasonForRecommendation: string;
  learningObjective: string;
  teacherInstructions: string[];
  requiredMaterials: string[];
  estimatedMinutes: number;
  /** Usable student-facing exercise content (words, Marungko syllables, phonics drill, or short story). */
  studentExercise: {
    instructions: string;
    wordList?: string[];
    marungkoSequenceLetters?: string[];
    syllables?: string[];
    passageTitle?: string;
    passageParagraphs?: string[];
    vocabularyItems?: Array<{ word: string; meaning: string }>;
    objectiveItems: InterventionObjectiveItem[];
    oralOrObservedPrompt?: string;
  };
  answerKeySummary: string;
  assessmentRubric: string;
  successCriteria: string;
  suggestedFollowUp: string;
  /** DepEd LR Portal attribution or AI-generated label. */
  resourceAttribution: {
    kind: MaterialSourceAttribution;
    resourceId?: string;
    resourceTitle?: string;
    sourceUrl?: string;
    materialType?: string;
    selectionReason?: string;
    label: string;
  };
  /** True when the activity requires teacher observation/oral review in addition to or instead of auto-grading. */
  requiresTeacherReview: boolean;
  approvedByTeacher: boolean;
  result?: InterventionActivityResult;
}

export interface InterventionAuditEntry {
  id: string;
  timestamp: ISODateString;
  actor: string;
  action:
    | "plan-created"
    | "plan-edited"
    | "status-changed"
    | "activity-auto-graded"
    | "activity-teacher-reviewed"
    | "activity-teacher-corrected"
    | "follow-up-created";
  summary: string;
}

/** Persisted Student Reading Intervention Plan (Grades 1–3). */
export interface InterventionPlan extends SyncMeta {
  id: string;
  learnerId: string;
  gradeLevel: 1 | 2 | 3;
  sectionId: string;
  sectionLabel: string;
  createdByTeacherId: string;
  status: InterventionPlanStatus;
  assessmentRefs: InterventionAssessmentRef[];
  skillGaps: string[];
  recommendedCategories: InterventionCategory[];
  learningObjectives: string[];
  schedule: string;
  activities: InterventionPlanActivity[];
  teacherNotes: string;
  followUpAssessmentSummary?: string;
  followUpFromPlanId?: string;
  aiMetadata?: {
    model: string;
    generatedAt: ISODateString;
    fallbackUsed: boolean;
    warning?: string;
  };
  auditLog: InterventionAuditEntry[];
  createdAt: ISODateString;
  approvedAt?: ISODateString;
  completedAt?: ISODateString;
}

/**
 * Names of the entity object stores. Single source of truth. These all hold
 * records keyed by `id` and participate in sync.
 */
export const STORES = {
  learners: "learners",
  teachers: "teachers",
  assessments: "assessments",
  assignments: "assignments",
  readingPassages: "readingPassages",
  readingAttempts: "readingAttempts",
  silentAttempts: "silentAttempts",
  pictureAttempts: "pictureAttempts",
  screeningAssessments: "screeningAssessments",
  interventionPlans: "interventionPlans",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/** All entity store names as an array (handy for iterating during sync). */
export const STORE_NAMES = Object.values(STORES) as StoreName[];

/**
 * Key-value store for sync bookkeeping (last pull time, in-flight flag). Keyed
 * by a plain string key, separate from the entity stores above.
 */
export const SYNC_STATE_STORE = "syncState" as const;

/** Known keys in the syncState store. */
export const SYNC_KEYS = {
  /** ISODateString of the last successful pull (the `since` cursor). */
  lastPulledAt: "lastPulledAt",
  /** "1" while a sync is running; guards against concurrent runs. */
  inFlight: "inFlight",
} as const;

/** Maps a store name to the entity type it holds. */
export interface StoreEntityMap {
  learners: Learner;
  teachers: Teacher;
  assessments: Assessment;
  assignments: Assignment;
  readingPassages: ReadingPassage;
  readingAttempts: ReadingAttempt;
  silentAttempts: SilentAttempt;
  pictureAttempts: PictureAttempt;
  screeningAssessments: ScreeningAssessment;
  interventionPlans: InterventionPlan;
}

/** Any persisted entity (union across the entity stores). */
export type Entity = StoreEntityMap[StoreName];

/** A single change in the sync protocol. */
export interface SyncChange {
  store: StoreName;
  op: "put" | "delete";
  record: Entity;
}

/** Request body for `POST /sync`. */
export interface SyncRequest {
  since: ISODateString | null;
  changes: SyncChange[];
}

/** Response body from `POST /sync`. */
export interface SyncResponse {
  serverTime: ISODateString;
  changes: SyncChange[];
}
