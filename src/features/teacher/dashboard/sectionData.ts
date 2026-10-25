/**
 * Section + learner data for the teacher dashboard and learner profile.
 *
 * The learners list (SECTIONS / LEARNERS / learnersForSection) is the single
 * source of truth for the teacher's student directory. Per-learner profile
 * *detail* (formal assessments, interventions, practice history, recommended
 * next steps, recent activity) starts empty — it will be populated from real
 * learner data as assessments are completed. `learnerProfile()` returns a
 * record-only profile with safe empty-state fallbacks until then.
 */

export type CrlaLevel = 'GR' | 'LR' | 'MR' | 'FR' | null

export interface LearnerRecord {
  id: string
  name: string
  initials: string
  grade: string
  /** Section this learner belongs to. */
  sectionId: string
  level: CrlaLevel
  lastActive: string
  /** Had activity within the last 24h. */
  activeToday: boolean
  /** Has a submitted assessment awaiting teacher review. */
  needsReview?: boolean
  /** Per-student access code — the learner must enter this to log in. */
  code: string
}

export interface Section {
  id: string
  label: string
}

/** `all` is a virtual section meaning "every learner". */
export const SECTIONS: Section[] = [
  { id: 'all', label: 'All Sections' },
  { id: 'sampaguita', label: 'Grade 1 · Sampaguita' },
  { id: 'rosal', label: 'Grade 2 · Rosal' },
  { id: 'mabini', label: 'Grade 3 · Mabini' },
]

// The student roster is kept, but all assessment-derived fields start empty
// (level = null, not active, nothing awaiting review). Dashboard stats and the
// CRLA distribution are computed from these, so they begin at zero until real
// assessment data populates them.
export const LEARNERS: LearnerRecord[] = [
  // Grade 3 · Mabini
  { id: 'BR-3101', name: 'Bea Ramos', initials: 'BR', grade: 'Grade 3-A', sectionId: 'mabini', level: null, lastActive: '—', activeToday: false, code: 'BEA123' },
  { id: 'GR-3012', name: 'Gabriel Reyes', initials: 'GR', grade: 'Grade 3-A', sectionId: 'mabini', level: null, lastActive: '—', activeToday: false, code: 'GAB456' },
  { id: 'LT-3044', name: 'Liza Tan', initials: 'LT', grade: 'Grade 3-A', sectionId: 'mabini', level: null, lastActive: '—', activeToday: false, code: 'LIZ789' },

  // Grade 2 · Rosal
  { id: 'JD-1083', name: 'Juan Dela Cruz', initials: 'JD', grade: 'Grade 2-A', sectionId: 'rosal', level: null, lastActive: '—', activeToday: false, code: 'JUA234' },
  { id: 'CG-2210', name: 'Carlo Garcia', initials: 'CG', grade: 'Grade 2-A', sectionId: 'rosal', level: null, lastActive: '—', activeToday: false, code: 'CAR567' },
  { id: 'MP-2255', name: 'Mika Perez', initials: 'MP', grade: 'Grade 2-A', sectionId: 'rosal', level: null, lastActive: '—', activeToday: false, code: 'MIK890' },

  // Grade 1 · Sampaguita
  { id: 'AS-2041', name: 'Amina Santos', initials: 'AS', grade: 'Grade 1-B', sectionId: 'sampaguita', level: null, lastActive: '—', activeToday: false, code: 'AMI345' },
  { id: 'SM-1120', name: 'Sofia Manuel', initials: 'SM', grade: 'Grade 1-B', sectionId: 'sampaguita', level: null, lastActive: '—', activeToday: false, code: 'SOF678' },
  { id: 'RB-1130', name: 'Rafael Bautista', initials: 'RB', grade: 'Grade 1-B', sectionId: 'sampaguita', level: null, lastActive: '—', activeToday: false, code: 'RAF901' },
]

/* ------------------------------------------------------------------ */
/* Learner access codes + live "active now" status                     */
/* ------------------------------------------------------------------ */

const ACTIVE_STORAGE_KEY = 'talas-active-learners'

/** Reads the set of currently-active learner ids from localStorage. */
function readActiveIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ACTIVE_STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function writeActiveIds(ids: Set<string>): void {
  try {
    localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* storage unavailable — status just won't persist across reloads */
  }
}

/**
 * Finds a learner by access code (case-insensitive, trimmed). Returns the
 * record or null if the code doesn't match any student.
 */
export function findLearnerByCode(code: string): LearnerRecord | null {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  return LEARNERS.find((l) => l.code.toUpperCase() === normalized) ?? null
}

/** Marks a learner active ("Now") — reflected on the teacher roster. */
export function setLearnerActive(id: string): void {
  const ids = readActiveIds()
  ids.add(id)
  writeActiveIds(ids)
}

/** Clears a learner's active status. */
export function setLearnerInactive(id: string): void {
  const ids = readActiveIds()
  ids.delete(id)
  writeActiveIds(ids)
}

/** True if the learner is currently marked active. */
export function isLearnerActive(id: string): boolean {
  return readActiveIds().has(id)
}

/** Returns the learners for a section id, or all learners for `all`. */
export function learnersForSection(sectionId: string): LearnerRecord[] {
  if (sectionId === 'all') return LEARNERS
  return LEARNERS.filter((l) => l.sectionId === sectionId)
}

export function sectionLabel(sectionId: string): string {
  return SECTIONS.find((s) => s.id === sectionId)?.label ?? 'All Sections'
}

/* ------------------------------------------------------------------ */
/* CRLA level labels/descriptions (static UI copy)                     */
/* ------------------------------------------------------------------ */

const CRLA_LABEL: Record<Exclude<CrlaLevel, null>, string> = {
  GR: 'Grade Ready',
  LR: 'Light Refresher',
  MR: 'Moderate Refresher',
  FR: 'Full Refresher',
}

export function crlaLabel(level: CrlaLevel): string {
  return level ? CRLA_LABEL[level] : 'Not yet assessed'
}

const CRLA_DESCRIPTION: Record<Exclude<CrlaLevel, null>, string> = {
  GR: 'Demonstrates mastery of previous concepts and is ready for grade-level reading instruction.',
  LR: 'Grasps basic concepts but needs practice to improve speed, accuracy, or minor skill gaps.',
  MR: 'Requires structured assistance, guided practice, and targeted intervention.',
  FR: 'Needs direct, intensive instruction starting from foundational concepts (such as letter sounds or phonological awareness).',
}

export function crlaDescription(level: CrlaLevel): string {
  return level
    ? CRLA_DESCRIPTION[level]
    : 'No formal reading classification on record yet.'
}

/* ------------------------------------------------------------------ */
/* Learner profile types                                               */
/* ------------------------------------------------------------------ */

export type FormalAssessmentType = 'Oral' | 'Silent'

export interface FormalAssessmentRecord {
  id: string
  period: string
  /** Oral (read-aloud miscue/fluency) vs Silent (reading comprehension). */
  type: FormalAssessmentType
  classification: string
  readerStage: string
  dateFinalized: string
  assessor: string
  miscues: string
  comprehension: string
  phonemesFlagged: string[]
  /** Finalized formal records are read-only. */
  status: 'Finalized'
}

export type InterventionStatus = 'Active' | 'Completed' | 'Discontinued'

export interface InterventionRecord {
  id: string
  title: string
  tier: string
  /** Reading skill / need this plan targets. */
  targetSkill: string
  status: InterventionStatus
  dateAssigned: string
  directive: string
  description: string
  modulesCompleted: number
  modulesTotal: number
  nextSession: string
}

export type PracticeTrend = 'Improving' | 'Steady' | 'Needs attention'

export interface PracticeActivityEntry {
  date: string
  activity: string
  accuracyPct: number
  detail: string
}

export interface PracticeRecord {
  level: string
  domain: string
  trend: PracticeTrend
  recentAccuracy: { label: string; pct: number }[]
  history: PracticeActivityEntry[]
  note: string
}

export interface RecentActivityItem {
  date: string
  type: 'Formal Assessment' | 'Practice' | 'Intervention'
  label: string
  detail: string
}

export interface RecommendationItem {
  id: string
  /** Short recommendation text (system-generated next step). */
  detail: string
  /** What this recommendation is based on. */
  basis: string
  status: 'Pending' | 'Approved' | 'Dismissed'
}

export interface LearnerProfile {
  /** Convenience copy of the base record. */
  record: LearnerRecord
  className: string
  adviser: string
  motherTongue: string
  pin: string
  classCode: string
  status: string
  formal: FormalAssessmentRecord | null
  formalHistory: FormalAssessmentRecord[]
  practice: PracticeRecord | null
  intervention: InterventionRecord | null
  interventionHistory: InterventionRecord[]
  recommendations: RecommendationItem[]
  pedagogicalNote: string
  recentActivity: RecentActivityItem[]
}

/**
 * Per-learner profile detail keyed by learner id. Empty for now — profile
 * detail will come from real learner data. `learnerProfile()` fills in safe
 * empty-state defaults so the profile tabs render without mock content.
 */
const PROFILE_DETAIL: Record<
  string,
  Omit<LearnerProfile, 'record' | 'status'>
> = {}

const FALLBACK_NOTE = 'No pedagogical notes recorded yet for this learner.'

/** Builds a profile view for a learner id, or null if unknown. */
export function learnerProfile(id: string | undefined): LearnerProfile | null {
  if (!id) return null
  const record = LEARNERS.find((l) => l.id === id)
  if (!record) return null

  const detail = PROFILE_DETAIL[id]
  const className =
    detail?.className ??
    SECTIONS.find((s) => s.id === record.sectionId)?.label.split('·')[1]?.trim() ??
    record.sectionId

  return {
    record,
    className,
    adviser: detail?.adviser ?? 'Teacher Maria',
    motherTongue: detail?.motherTongue ?? 'Tagalog',
    pin: detail?.pin ?? record.id.replace(/\D/g, ''),
    classCode: detail?.classCode ?? `TALAS-${record.grade.replace(/\s/g, '')}`,
    status: record.level ? 'Active Learner' : 'Awaiting Assessment',
    formal: detail?.formal ?? null,
    formalHistory: detail?.formalHistory ?? (detail?.formal ? [detail.formal] : []),
    practice: detail?.practice ?? null,
    intervention: detail?.intervention ?? null,
    interventionHistory: detail?.interventionHistory ?? [],
    recommendations: detail?.recommendations ?? [],
    pedagogicalNote: detail?.pedagogicalNote ?? FALLBACK_NOTE,
    recentActivity: detail?.recentActivity ?? [],
  }
}
