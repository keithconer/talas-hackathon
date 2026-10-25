import { CRLA_PROFILE_LABEL, gradeCrla } from "../../../reading/crla";
import type {
  InterventionActivityResult,
  InterventionAssessmentRef,
  InterventionAuditEntry,
  InterventionCategory,
  InterventionObjectiveItem,
  InterventionPlan,
  InterventionPlanActivity,
  InterventionPlanStatus,
  Learner,
  PictureAttempt,
  ReadingAttempt,
  ScreeningAssessment,
  SilentAttempt,
} from "../../../data/types";
import {
  buildResourceAttribution,
  DEPED_ARAL_LR_PORTAL_URL,
  DEPED_LR_CATALOG,
  filterDepEdResources,
  type DepEdResource,
} from "./depedCatalog";
import { callGeminiInterventionEndpoint } from "../../../services/gemini";

export const INTERVENTION_SECTIONS = [
  { id: "sampaguita", name: "Sampaguita", grade: "Grade 1" },
  { id: "rosal", name: "Rosal", grade: "Grade 2" },
  { id: "mabini", name: "Mabini", grade: "Grade 3" },
] as const;

/**
 * Official Marungko Approach letter introduction sequence in Filipino foundational literacy.
 */
export const MARUNGKO_SEQUENCE = [
  "m",
  "s",
  "a",
  "i",
  "o",
  "b",
  "e",
  "u",
  "t",
  "k",
  "l",
  "y",
  "n",
  "g",
  "ng",
  "p",
  "r",
  "d",
  "w",
  "h",
] as const;

export const SUPPORTED_INTERVENTION_CATEGORIES: readonly InterventionCategory[] = [
  "Word Recognition",
  "Marungko",
  "Letter Sounds",
  "Short Stories",
];

export const ACTIVE_PLAN_STATUSES: readonly InterventionPlanStatus[] = [
  "Draft",
  "Pending Review",
  "Approved",
  "In Progress",
];

/**
 * Parse a learner's grade string (e.g. "Grade 1", "Baitang 2", "3") into 1 | 2 | 3.
 * Returns null for any grade outside Grades 1–3 (e.g. Kinder, Grade 4, Grade 5, Grade 6).
 */
export function parseGradeLevel(grade: string | number | null | undefined): 1 | 2 | 3 | null {
  if (grade === null || grade === undefined) return null;
  if (typeof grade === "number") {
    return grade === 1 || grade === 2 || grade === 3 ? grade : null;
  }
  const trimmed = grade.trim();
  const match = trimmed.match(/^(?:grade|baitang)?\s*([0-9]+)(?:\s*[-·]\s*[a-z0-9\s]+)?$/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (num === 1 || num === 2 || num === 3) {
    return num;
  }
  return null;
}

export function isGradeEligibleForIntervention(grade: string | number | null | undefined): boolean {
  return parseGradeLevel(grade) !== null;
}

export interface TeacherAccessContext {
  teacherId: string;
  isAuthenticated: boolean;
  authorizedSectionIds: string[];
}

export const DEFAULT_TEACHER_ACCESS: TeacherAccessContext = {
  teacherId: "teacher-maria",
  isAuthenticated: true,
  authorizedSectionIds: INTERVENTION_SECTIONS.map((s) => s.id),
};

/**
 * Enforce authentication, Grades 1–3 restriction, and teacher section ownership.
 */
export function assertTeacherCanAccessLearner(
  teacher: TeacherAccessContext,
  learner: Pick<Learner, "id" | "name" | "grade" | "sectionId">
): { allowed: boolean; gradeLevel?: 1 | 2 | 3; reason?: string } {
  if (!teacher.isAuthenticated || !teacher.teacherId) {
    return {
      allowed: false,
      reason: "Unauthorized: Teacher authentication is required to manage intervention plans.",
    };
  }

  const gradeLevel = parseGradeLevel(learner.grade);
  if (!gradeLevel) {
    return {
      allowed: false,
      reason: `Student ${learner.name} (${learner.grade ?? "unknown"}) is outside the supported Grades 1–3 range.`,
    };
  }

  if (
    !learner.sectionId ||
    !(teacher.authorizedSectionIds as readonly string[]).includes(learner.sectionId)
  ) {
    return {
      allowed: false,
      reason: `Unauthorized: Student ${learner.name} belongs to section '${learner.sectionId ?? "unassigned"}', which is outside teacher '${teacher.teacherId}' responsibility.`,
    };
  }

  return { allowed: true, gradeLevel };
}

export interface RawAssessmentInput {
  id: string;
  kind: "screening" | "oral" | "silent" | "picture";
  title: string;
  date: string;
  score: number | null | undefined;
  maxScore: number | null | undefined;
  usesZeroToSixteenThreshold?: boolean;
  /** Optional CRLA profile for oral/silent reading assessments ("FR" | "MR" | "LR" | "GR"). */
  crlaProfile?: "FR" | "MR" | "LR" | "GR";
  remarks?: string;
}

export interface AssessmentEligibilityEvaluation {
  eligible: boolean;
  valid: boolean;
  statusLabel: "Eligible (0–16 Scale)" | "Eligible (CRLA Refresher)" | "Not Eligible" | "Ungraded / Invalid";
  remarks: string;
}

/**
 * Evaluate a single assessment record for intervention eligibility.
 * - Missing, null, undefined, NaN, negative, or > maxScore values are treated as ungraded/invalid, NEVER as 0.
 * - Scores 0 through 16 (inclusive) trigger eligibility ONLY when `usesZeroToSixteenThreshold` is true
 *   (the 20-item Reading Intervention Screening scale).
 * - Assessments with different maximum scores (Oral Reading 0–100%, Silent Reading 0–4, Picture 0–5, etc.)
 *   are never compared raw against 0–16; they use existing CRLA refresher classification (FR/MR).
 */
export function evaluateAssessmentEligibility(
  input: RawAssessmentInput
): AssessmentEligibilityEvaluation {
  const { score, maxScore, usesZeroToSixteenThreshold, kind, crlaProfile } = input;

  if (
    score === null ||
    score === undefined ||
    typeof score !== "number" ||
    Number.isNaN(score) ||
    maxScore === null ||
    maxScore === undefined ||
    typeof maxScore !== "number" ||
    Number.isNaN(maxScore) ||
    maxScore <= 0
  ) {
    return {
      eligible: false,
      valid: false,
      statusLabel: "Ungraded / Invalid",
      remarks: "No valid score recorded yet (not treated as zero).",
    };
  }

  if (score < 0 || score > maxScore) {
    return {
      eligible: false,
      valid: false,
      statusLabel: "Ungraded / Invalid",
      remarks: `Invalid score (${score}/${maxScore}) outside allowed range.`,
    };
  }

  // Case 1: Intended 0–16 threshold scale (20-item Reading Intervention Screening)
  if (usesZeroToSixteenThreshold === true) {
    if (score >= 0 && score <= 16) {
      const severity =
        score <= 8
          ? "Needs intensive foundational intervention (0–16 threshold)"
          : "Needs targeted reading intervention (0–16 threshold)";
      return {
        eligible: true,
        valid: true,
        statusLabel: "Eligible (0–16 Scale)",
        remarks: input.remarks || `${severity}: scored ${score}/${maxScore}.`,
      };
    }
    return {
      eligible: false,
      valid: true,
      statusLabel: "Not Eligible",
      remarks: input.remarks || `Meets screening benchmark (${score}/${maxScore}, above 0–16 intervention threshold).`,
    };
  }

  // Case 2: Assessments using different scales (Oral 0–100%, Silent 0–4, Picture 0–5, or custom maxScore)
  // Do NOT apply raw 0–16 comparison here.
  if (kind === "oral" || kind === "silent") {
    if (crlaProfile === "FR" || crlaProfile === "MR") {
      const label = crlaProfile === "FR" ? "Full Refresher" : "Moderate Refresher";
      return {
        eligible: true,
        valid: true,
        statusLabel: "Eligible (CRLA Refresher)",
        remarks: input.remarks || `${label} (${score}/${maxScore}) — requires reading support.`,
      };
    }
    return {
      eligible: false,
      valid: true,
      statusLabel: "Not Eligible",
      remarks:
        input.remarks ||
        `${crlaProfile === "LR" ? "Light Refresher" : "Grade Ready"} (${score}/${maxScore}) on ${kind} scale.`,
    };
  }

  // Picture practice (Salita at Larawan) or other non-0-16 supplementary activities:
  // Kept separate from Oral/Silent grades and does not trigger 0-16 screening on its own 5-item scale.
  return {
    eligible: false,
    valid: true,
    statusLabel: "Not Eligible",
    remarks:
      input.remarks ||
      `Supplementary activity score ${score}/${maxScore} (uses ${maxScore}-point scale, not 0–16 screening scale).`,
  };
}

export interface StudentInterventionSummary {
  learner: Learner;
  gradeLevel: 1 | 2 | 3;
  sectionLabel: string;
  eligible: boolean;
  eligibilityReason: string;
  latestScreening: ScreeningAssessment | null;
  latestOral: ReadingAttempt | null;
  latestSilent: SilentAttempt | null;
  latestPicture: PictureAttempt | null;
  assessmentRefs: InterventionAssessmentRef[];
  activePlan: InterventionPlan | null;
  latestPlan: InterventionPlan | null;
  interventionStatus: InterventionPlanStatus | "Needs Intervention" | "No Intervention Needed" | "Ungraded";
}

/**
 * Aggregate a learner's screening, oral, silent, and picture records into a unified
 * eligibility summary for the Teacher Intervention Dashboard.
 */
export function buildStudentInterventionSummary(params: {
  learner: Learner;
  screenings: ScreeningAssessment[];
  oralAttempts: ReadingAttempt[];
  silentAttempts: SilentAttempt[];
  pictureAttempts: PictureAttempt[];
  plans: InterventionPlan[];
}): StudentInterventionSummary | null {
  const gradeLevel = parseGradeLevel(params.learner.grade);
  if (!gradeLevel) return null;

  const sectionObj = INTERVENTION_SECTIONS.find((s) => s.id === params.learner.sectionId);
  const sectionLabel = sectionObj
    ? `${sectionObj.name} (${sectionObj.grade})`
    : params.learner.grade ?? `Grade ${gradeLevel}`;

  const sortedScreenings = [...params.screenings].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const sortedOral = [...params.oralAttempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const sortedSilent = [...params.silentAttempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const sortedPicture = [...params.pictureAttempts].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const sortedPlans = [...params.plans].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  const latestScreening = sortedScreenings[0] ?? null;
  const latestOral = sortedOral[0] ?? null;
  const latestSilent = sortedSilent[0] ?? null;
  const latestPicture = sortedPicture[0] ?? null;

  const assessmentRefs: InterventionAssessmentRef[] = [];

  // 1. Screening assessments (0–16 threshold on 20-item scale)
  for (const scr of sortedScreenings) {
    const evalResult = evaluateAssessmentEligibility({
      id: scr.id,
      kind: "screening",
      title: scr.assessmentName,
      date: scr.createdAt,
      score: scr.score,
      maxScore: scr.maxScore,
      usesZeroToSixteenThreshold: scr.usesZeroToSixteenThreshold,
      remarks: scr.remarks,
    });
    if (evalResult.valid && scr.score !== null) {
      assessmentRefs.push({
        id: scr.id,
        kind: "screening",
        title: scr.assessmentName,
        date: scr.createdAt,
        score: scr.score,
        maxScore: scr.maxScore,
        usesZeroToSixteenThreshold: scr.usesZeroToSixteenThreshold,
        eligibleTrigger: evalResult.eligible,
        remarks: evalResult.remarks,
      });
    }
  }

  // 2. Combined CRLA profile from latest oral + silent (or oral alone)
  const oralAccuracy = latestOral ? Math.round(latestOral.accuracy) : null;
  const comprehensionInput =
    latestSilent && latestSilent.totalQuestions > 0
      ? { correct: latestSilent.correctAnswers, total: latestSilent.totalQuestions }
      : null;

  const crlaClassification =
    oralAccuracy !== null || comprehensionInput !== null
      ? gradeCrla(oralAccuracy, comprehensionInput)
      : null;

  if (latestOral) {
    const oralWpm =
      latestOral.durationSec && latestOral.durationSec > 0
        ? Math.round((latestOral.correctWords / latestOral.durationSec) * 60)
        : null;
    const evalOral = evaluateAssessmentEligibility({
      id: latestOral.id,
      kind: "oral",
      title: `Oral Reading (${latestOral.passageId || "CRLA Passage"})`,
      date: latestOral.createdAt,
      score: Math.round(latestOral.accuracy),
      maxScore: 100,
      usesZeroToSixteenThreshold: false,
      crlaProfile: crlaClassification?.level,
      remarks: crlaClassification
        ? `${CRLA_PROFILE_LABEL[crlaClassification.level]} (${Math.round(latestOral.accuracy)}% accuracy${
            oralWpm !== null ? `, ${oralWpm} WPM` : ""
          })`
        : `${Math.round(latestOral.accuracy)}% accuracy`,
    });
    assessmentRefs.push({
      id: latestOral.id,
      kind: "oral",
      title: `Oral Reading: ${latestOral.passageId || "Passage"}`,
      date: latestOral.createdAt,
      score: Math.round(latestOral.accuracy),
      maxScore: 100,
      usesZeroToSixteenThreshold: false,
      eligibleTrigger: evalOral.eligible,
      remarks: evalOral.remarks,
    });
  }

  if (latestSilent) {
    const silentProfile =
      latestSilent.totalQuestions > 0
        ? gradeCrla(oralAccuracy, {
            correct: latestSilent.correctAnswers,
            total: latestSilent.totalQuestions,
          }).level
        : undefined;

    const evalSilent = evaluateAssessmentEligibility({
      id: latestSilent.id,
      kind: "silent",
      title: `Silent Reading (${latestSilent.title || "Comprehension"})`,
      date: latestSilent.createdAt,
      score: latestSilent.correctAnswers,
      maxScore: latestSilent.totalQuestions || 4,
      usesZeroToSixteenThreshold: false,
      crlaProfile: silentProfile,
      remarks: `Comprehension ${latestSilent.correctAnswers}/${latestSilent.totalQuestions} (${latestSilent.scorePercent}%)`,
    });
    assessmentRefs.push({
      id: latestSilent.id,
      kind: "silent",
      title: `Silent Reading: ${latestSilent.title || "Passage"}`,
      date: latestSilent.createdAt,
      score: latestSilent.correctAnswers,
      maxScore: latestSilent.totalQuestions || 4,
      usesZeroToSixteenThreshold: false,
      eligibleTrigger: evalSilent.eligible,
      remarks: evalSilent.remarks,
    });
  }

  if (latestPicture) {
    const evalPic = evaluateAssessmentEligibility({
      id: latestPicture.id,
      kind: "picture",
      title: `Salita at Larawan (${latestPicture.title})`,
      date: latestPicture.createdAt,
      score: latestPicture.correctAnswers,
      maxScore: latestPicture.totalQuestions,
      usesZeroToSixteenThreshold: false,
      remarks: `Salita at Larawan ${latestPicture.correctAnswers}/${latestPicture.totalQuestions} (Separate Practice)`,
    });
    assessmentRefs.push({
      id: latestPicture.id,
      kind: "picture",
      title: `Salita at Larawan (${latestPicture.title})`,
      date: latestPicture.createdAt,
      score: latestPicture.correctAnswers,
      maxScore: latestPicture.totalQuestions,
      usesZeroToSixteenThreshold: false,
      eligibleTrigger: evalPic.eligible,
      remarks: evalPic.remarks,
    });
  }

  const triggeringRefs = assessmentRefs.filter((r) => r.eligibleTrigger);
  const eligible = triggeringRefs.length > 0;

  let eligibilityReason = "No completed assessments yet.";
  if (assessmentRefs.length > 0) {
    if (eligible) {
      eligibilityReason = triggeringRefs.map((r) => `${r.title}: ${r.remarks}`).join(" | ");
    } else {
      eligibilityReason = "Scores meet benchmark on applicable scales.";
    }
  }

  const activePlan =
    sortedPlans.find((p) => ACTIVE_PLAN_STATUSES.includes(p.status)) ?? null;
  const latestPlan = sortedPlans[0] ?? null;

  let interventionStatus: StudentInterventionSummary["interventionStatus"];
  if (activePlan) {
    interventionStatus = activePlan.status;
  } else if (latestPlan && latestPlan.status === "Completed" && !eligible) {
    interventionStatus = "Completed";
  } else if (assessmentRefs.length === 0) {
    interventionStatus = "Ungraded";
  } else if (eligible) {
    interventionStatus = "Needs Intervention";
  } else {
    interventionStatus = "No Intervention Needed";
  }

  return {
    learner: params.learner,
    gradeLevel,
    sectionLabel,
    eligible,
    eligibilityReason,
    latestScreening,
    latestOral,
    latestSilent,
    latestPicture,
    assessmentRefs,
    activePlan,
    latestPlan,
    interventionStatus,
  };
}

/**
 * Guard against duplicate active intervention plans for the same learner and assessment
 * unless the teacher explicitly creates a follow-up plan (`isFollowUp: true`).
 */
export function canCreateInterventionPlan(params: {
  existingPlans: InterventionPlan[];
  learnerId: string;
  assessmentIds: string[];
  isFollowUp?: boolean;
}): { allowed: boolean; reason?: string; conflictingPlanId?: string } {
  if (params.isFollowUp) {
    return { allowed: true };
  }

  const learnerActivePlans = params.existingPlans.filter(
    (plan) =>
      plan.learnerId === params.learnerId &&
      ACTIVE_PLAN_STATUSES.includes(plan.status)
  );

  for (const plan of learnerActivePlans) {
    const existingIds = new Set(plan.assessmentRefs.map((r) => r.id));
    const hasOverlap =
      params.assessmentIds.length === 0 ||
      params.assessmentIds.some((id) => existingIds.has(id));
    if (hasOverlap) {
      return {
        allowed: false,
        reason: `An active intervention plan (${plan.status}) already exists for this student and assessment record. Review the existing plan or create a follow-up plan instead.`,
        conflictingPlanId: plan.id,
      };
    }
  }

  return { allowed: true };
}

/**
 * Determine ONLY the relevant intervention categories based on the student's demonstrated
 * assessment scores and skill gaps. Never assigns all four categories blindly.
 */
export function selectRelevantInterventionCategories(params: {
  gradeLevel: 1 | 2 | 3;
  assessmentRefs: InterventionAssessmentRef[];
  oralAttempt?: ReadingAttempt | null;
  silentAttempt?: SilentAttempt | null;
  pictureAttempt?: PictureAttempt | null;
  teacherObservations?: string;
}): { categories: InterventionCategory[]; skillGaps: string[] } {
  const categories = new Set<InterventionCategory>();
  const skillGaps: string[] = [];

  const screeningRefs = params.assessmentRefs.filter(
    (r) => r.kind === "screening" && r.usesZeroToSixteenThreshold
  );
  const lowestScreening =
    screeningRefs.length > 0
      ? Math.min(...screeningRefs.map((r) => r.score))
      : null;

  const oralAccuracy = params.oralAttempt ? params.oralAttempt.accuracy : null;
  const silentRatio =
    params.silentAttempt && params.silentAttempt.totalQuestions > 0
      ? params.silentAttempt.correctAnswers / params.silentAttempt.totalQuestions
      : null;
  const pictureRatio =
    params.pictureAttempt && params.pictureAttempt.totalQuestions > 0
      ? params.pictureAttempt.correctAnswers / params.pictureAttempt.totalQuestions
      : null;

  const obs = (params.teacherObservations ?? "").toLowerCase();

  // Severe foundational need (Screening 0–8 or Oral accuracy < 75%)
  if (
    (lowestScreening !== null && lowestScreening <= 8) ||
    (oralAccuracy !== null && oralAccuracy < 75) ||
    obs.includes("tunog") ||
    obs.includes("letter") ||
    obs.includes("pantig") ||
    obs.includes("marungko")
  ) {
    categories.add("Letter Sounds");
    categories.add("Marungko");
    skillGaps.push(
      "Pagkilala sa tunog ng titik at pagsasama ng mga tunog upang makabuo ng pantig (Marungko / Letter Sounds)"
    );
  }

  // Moderate word recognition / decoding need (Screening 9–13, Oral 75–90%, or low Salita at Larawan)
  if (
    (lowestScreening !== null && lowestScreening >= 9 && lowestScreening <= 13) ||
    (oralAccuracy !== null && oralAccuracy >= 75 && oralAccuracy <= 90) ||
    (pictureRatio !== null && pictureRatio < 0.7) ||
    obs.includes("salita") ||
    obs.includes("word")
  ) {
    if (params.gradeLevel === 1 && categories.size === 0) {
      categories.add("Marungko");
    }
    categories.add("Word Recognition");
    skillGaps.push(
      "Mabilis at wastong pagkilala ng mga karaniwang salitang Filipino at pag-uugnay sa kahulugan (Word Recognition)"
    );
  }

  // Mild-to-moderate comprehension or fluency need (Screening 14–16 or Silent reading < 75%)
  if (
    (lowestScreening !== null && lowestScreening >= 14 && lowestScreening <= 16) ||
    (silentRatio !== null && silentRatio < 0.75) ||
    obs.includes("kuwento") ||
    obs.includes("pag-unawa") ||
    obs.includes("comprehension")
  ) {
    categories.add("Short Stories");
    skillGaps.push(
      "Pag-unawa sa binasang maikling kuwento at pagsagot sa mga literal at hinuha na tanong (Short Stories)"
    );
  }

  // Ensure at least one targeted category is chosen if the student was selected for intervention
  if (categories.size === 0) {
    if (params.gradeLevel === 1) {
      categories.add("Marungko");
      skillGaps.push(
        "Pagpapatibay ng batayang pagbasa ng pantig at payak na salita gamit ang Marungko Approach"
      );
    } else {
      categories.add("Word Recognition");
      skillGaps.push(
        "Pagpapatibay ng pagkilala sa mga salitang angkop sa baitang at talasalitaan"
      );
    }
  }

  return {
    categories: Array.from(categories),
    skillGaps,
  };
}

/**
 * Validate that a Marungko activity follows the official Marungko letter sequence
 * and only uses words formed from letters up to the highest target letter in the sequence.
 */
export function validateMarungkoActivity(
  sequenceLetters: string[],
  words: string[]
): {
  valid: boolean;
  normalizedLetters: string[];
  validWords: string[];
} {
  const normalizedLetters = sequenceLetters
    .map((l) => l.trim().toLowerCase())
    .filter((l): l is (typeof MARUNGKO_SEQUENCE)[number] =>
      (MARUNGKO_SEQUENCE as readonly string[]).includes(l)
    );

  const effectiveLetters =
    normalizedLetters.length > 0
      ? normalizedLetters
      : ["m", "s", "a", "i", "o", "b"];

  // Sort letters strictly according to MARUNGKO_SEQUENCE order
  const orderedLetters = [... new Set(effectiveLetters)].sort(
    (a, b) =>
      MARUNGKO_SEQUENCE.indexOf(a as (typeof MARUNGKO_SEQUENCE)[number]) -
      MARUNGKO_SEQUENCE.indexOf(b as (typeof MARUNGKO_SEQUENCE)[number])
  );

  const maxIndex = Math.max(
    ...orderedLetters.map((l) =>
      MARUNGKO_SEQUENCE.indexOf(l as (typeof MARUNGKO_SEQUENCE)[number])
    ),
    4 // At least m, s, a, i, o
  );
  const allowedSet = new Set<string>(MARUNGKO_SEQUENCE.slice(0, maxIndex + 1));

  const tokenizeFilipinoWord = (word: string): string[] => {
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    const tokens: string[] = [];
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === "n" && clean[i + 1] === "g") {
        tokens.push("ng");
        i++;
      } else {
        tokens.push(clean[i]);
      }
    }
    return tokens;
  };

  const validWords = words.filter((w) => {
    const tokens = tokenizeFilipinoWord(w);
    return tokens.length > 0 && tokens.every((t) => allowedSet.has(t));
  });

  const fallbackMarungkoWords = [
    "mama",
    "masa",
    "sama",
    "misa",
    "sisa",
    "aso",
    "isa",
    "oso",
    "basa",
    "saba",
  ];

  return {
    valid:
      orderedLetters.join(",") === normalizedLetters.join(",") &&
      validWords.length === words.length &&
      words.length > 0,
    normalizedLetters: orderedLetters,
    validWords: validWords.length >= 4 ? validWords : fallbackMarungkoWords,
  };
}

const PROHIBITED_DIAGNOSIS_PATTERNS = [
  /\bdyslexi(?:a|c)\b/gi,
  /\badhd\b/gi,
  /\bautis(?:m|tic)\b/gi,
  /\blearning\s+disabilit(?:y|ies)\b/gi,
  /\bintellectual\s+disabilit(?:y|ies)\b/gi,
  /\bclinical(?:ly)?\s+diagnos(?:ed|is)\b/gi,
  /\bneurodevelopmental\s+disorder\b/gi,
];

/**
 * Sanitize text so recommendations never claim a student has a clinical learning disability
 * or medical diagnosis based on assessment scores.
 */
export function sanitizeClinicalLanguage(text: string): string {
  let result = text;
  for (const pattern of PROHIBITED_DIAGNOSIS_PATTERNS) {
    result = result.replace(pattern, "observable reading skill gap");
  }
  return result;
}

/**
 * Build a deterministic, curriculum-aligned fallback activity for a given category and grade level.
 * Used when Gemini is unavailable/malformed or to fill missing fields.
 */
export function buildDefaultActivityForCategory(params: {
  category: InterventionCategory;
  gradeLevel: 1 | 2 | 3;
  assessmentReason: string;
  availableResources: DepEdResource[];
}): InterventionPlanActivity {
  const matchedResource =
    params.availableResources.find(
      (r) => r.gradeLevel === params.gradeLevel && r.category === params.category
    ) ?? null;

  const attribution = matchedResource
    ? buildResourceAttribution(
        params.category === "Short Stories"
          ? "ai-questions-from-deped-resource"
          : "existing-deped-material",
        matchedResource,
        `Pinili mula sa DepEd ARAL KS1 SY 2026–2027 catalog para sa Baitang ${params.gradeLevel} (${params.category}).`
      )
    : buildResourceAttribution(
        "ai-generated-supplementary",
        null,
        `Walang eksaktong katumbas sa DepEd catalog; binuo bilang karagdagang pagsasanay sa Baitang ${params.gradeLevel} (${params.category}).`
      );

  const id = `act-${params.category.toLowerCase().replace(/\s+/g, "-")}-g${params.gradeLevel}`;

  if (params.category === "Marungko") {
    const marungkoLetters =
      params.gradeLevel === 1
        ? ["m", "s", "a", "i", "o", "b"]
        : params.gradeLevel === 2
        ? ["m", "s", "a", "i", "o", "b", "e", "u", "t", "k"]
        : ["m", "s", "a", "i", "o", "b", "e", "u", "t", "k", "l", "y", "n", "g"];

    const wordList =
      params.gradeLevel === 1
        ? ["mama", "masa", "sama", "misa", "aso", "isa", "basa", "saba"]
        : params.gradeLevel === 2
        ? ["basa", "tasa", "kubo", "bote", "keso", "buto", "mata", "sako"]
        : ["lata", "yaya", "nanay", "gatas", "bunga", "ulap", "tubig", "kulay"];

    return {
      id,
      title: `Pagsasanay sa Marungko: Tunog, Pantig, at Salita (Baitang ${params.gradeLevel})`,
      category: "Marungko",
      skillGapAddressed: sanitizeClinicalLanguage(
        "Pagkilala sa tunog ng titik at pagsasama ng pantig sa tamang pagkakasunod-sunod ng Marungko Approach."
      ),
      reasonForRecommendation: sanitizeClinicalLanguage(params.assessmentReason),
      learningObjective: `Makabasa ng mga pantig, salita, at payak na parirala gamit ang pagkakasunod-sunod ng titik sa Marungko (${marungkoLetters.join(", ")}).`,
      teacherInstructions: [
        `Ipakita at iparinig nang malinaw ang tunog ng bawat titik sa pagkakasunod-sunod ng Marungko: ${marungkoLetters.join(", ")}.`,
        "Ipabigkas sa mag-aaral ang pinagsamang tunog upang makabuo ng pantig (hal. ma, sa, ba, ми, so).",
        "Ipabasa ang listahan ng mga salita at pasagutan ang pagsasanay sa pagbubuo ng salita.",
      ],
      requiredMaterials: [
        "Marungko letter at syllable flashcards",
        attribution.resourceTitle || "Sanayang papel sa Marungko",
        "Lapis at sagutang papel",
      ],
      estimatedMinutes: 20,
      studentExercise: {
        instructions:
          "Basahin ang mga pantig at salita. Pagkatapos, piliin ang tamang pantig o salita sa bawat bilang.",
        marungkoSequenceLetters: marungkoLetters,
        syllables: ["ma", "sa", "mi", "si", "mo", "so", "ba", "bi", "bo"],
        wordList,
        objectiveItems: [
          {
            id: `${id}-q1`,
            prompt: "Anong salita ang mabubuo kapag pinagsama ang pantig na 'ba' at 'sa'?",
            choices: ["basa", "masa", "sama", "saba"],
            answerKey: "basa",
            points: 1,
          },
          {
            id: `${id}-q2`,
            prompt: "Alin sa mga sumusunod ang nagsisimula sa tunog na /m/?",
            choices: ["mama", "aso", "saba", "isa"],
            answerKey: "mama",
            points: 1,
          },
          {
            id: `${id}-q3`,
            prompt: "Piliin ang tamang nawawalang pantig: ___ + sa = masa (pagpipilian: ma, ba, sa)",
            choices: ["ma", "ba", "sa"],
            answerKey: "ma",
            points: 1,
          },
        ],
        oralOrObservedPrompt:
          "Ipabasa nang malakas ang 8 salita sa listahan at itala kung ilang salita ang nabasa nang walang tulong.",
      },
      answerKeySummary: "1. basa | 2. mama | 3. ma",
      assessmentRubric:
        "3/3 sa objective items at 7–8/8 sa binasang salita = Naisagawa nang lubos; 2/3 at 5–6/8 = Katamtamang kasanayan; 0–1/3 = Kailangan pa ng paggabay.",
      successCriteria:
        "Nababasa nang wasto ang hindi bababa sa 80% ng mga pantig at salita sa Marungko drill at nakasasagot ng 2–3 sa 3 tanong.",
      suggestedFollowUp:
        "Idagdag ang susunod na 2 titik sa Marungko sequence sa susunod na linggo kapag naabot ang success criteria.",
      resourceAttribution: attribution,
      requiresTeacherReview: true,
      approvedByTeacher: false,
    };
  }

  if (params.category === "Letter Sounds") {
    return {
      id,
      title: `Kamalayang Ponolohiko: Pagtukoy sa Unahan at Hulihang Tunog (Baitang ${params.gradeLevel})`,
      category: "Letter Sounds",
      skillGapAddressed: sanitizeClinicalLanguage(
        "Pagtukoy at pagtutugma ng tunog ng titik sa unahan, gitna, at hulihan ng salitang Filipino."
      ),
      reasonForRecommendation: sanitizeClinicalLanguage(params.assessmentReason),
      learningObjective: `Matukoy nang wasto ang unahan, gitna, at hulihang tunog ng mga salitang angkop sa Baitang ${params.gradeLevel}.`,
      teacherInstructions: [
        "Bigkasin nang malinaw ang bawat salita at iparinig ang unahang tunog.",
        "Ipatukoy sa mag-aaral ang titik na kumakatawan sa tunog na narinig.",
        "Pasagutan ang 3-item phonics matching exercise at suriin ang pagbigkas.",
      ],
      requiredMaterials: [
        "Larawan at titik flashcards",
        attribution.resourceTitle || "Sanayang Papel sa Tunog ng Titik",
      ],
      estimatedMinutes: 15,
      studentExercise: {
        instructions:
          "Pakinggan o basahin ang bawat salita. Piliin ang tamang titik para sa hinihinging tunog.",
        wordList: ["bola", "saging", "kubo", "palay", "dahon", "ngipin"],
        objectiveItems: [
          {
            id: `${id}-q1`,
            prompt: "Ano ang unang titik ng salitang 'bola'?",
            choices: ["b", "d", "p", "m"],
            answerKey: "b",
            points: 1,
          },
          {
            id: `${id}-q2`,
            prompt: "Ano ang huling titik ng salitang 'kubo'?",
            choices: ["o", "u", "a", "k"],
            answerKey: "o",
            points: 1,
          },
          {
            id: `${id}-q3`,
            prompt: "Aling salita ang nagsisimula sa digrapong 'ng'?",
            choices: ["ngipin", "nanay", "gatas", "bahay"],
            answerKey: "ngipin",
            points: 1,
          },
        ],
        oralOrObservedPrompt:
          "Ipa-tunog sa mag-aaral ang /b/, /s/, /k/, /p/, /d/, at /ng/ nang malinaw.",
      },
      answerKeySummary: "1. b | 2. o | 3. ngipin",
      assessmentRubric:
        "3/3 = Lubos na natutukoy ang tunog; 2/3 = Katamtaman; 0–1/3 = Nangangailangan ng karagdagang pagsasanay.",
      successCriteria:
        "Nakakukuha ng hindi bababa sa 2/3 sa pagsasanay at nabibigkas nang tama ang 5 sa 6 na target na tunog.",
      suggestedFollowUp:
        "Isunod ang pagsasanay sa pagsasama ng katinig at patinig (Marungko syllable blending).",
      resourceAttribution: attribution,
      requiresTeacherReview: false,
      approvedByTeacher: false,
    };
  }

  if (params.category === "Word Recognition") {
    const gradeWords =
      params.gradeLevel === 1
        ? ["bahay", "tubig", "araw", "bulaklak", "paaralan", "kaibigan", "masaya", "malinis"]
        : params.gradeLevel === 2
        ? ["magalang", "tumulong", "kapaligiran", "pamilya", "tindahan", "naglakad", "masipag", "tahimik"]
        : ["nagkakaisa", "mamamayan", "kalikasan", "responsable", "pagtutulungan", "edukasyon", "matapat", "mapagmahal"];

    return {
      id,
      title: `Pagkilala ng Salita at Talasalitaan sa Konteksto (Baitang ${params.gradeLevel})`,
      category: "Word Recognition",
      skillGapAddressed: sanitizeClinicalLanguage(
        "Mabilis na pagkilala sa mga karaniwang salitang Filipino at pag-unawa sa kahulugan nito sa pangungusap."
      ),
      reasonForRecommendation: sanitizeClinicalLanguage(params.assessmentReason),
      learningObjective: `Makilala at mabasa nang wasto ang mga gamiting salita sa Baitang ${params.gradeLevel} at magamit ang mga ito sa pangungusap.`,
      teacherInstructions: [
        "Ipabasa nang malakas ang mga salita sa flashcard o listahan sa loob ng 1 minuto.",
        "Talakayin ang kahulugan ng bawat salita gamit ang payak na pangungusap.",
        "Pasagutan ang pagsasanay sa pagpili ng angkop na salita sa pangungusap.",
      ],
      requiredMaterials: [
        "Sight word flashcards",
        attribution.resourceTitle || "Sanayang Papel sa Pagkilala ng Salita",
      ],
      estimatedMinutes: 20,
      studentExercise: {
        instructions:
          "Basahin ang mga salita sa kahon at piliin ang tamang salita na bubuo sa bawat pangungusap.",
        wordList: gradeWords,
        objectiveItems: [
          {
            id: `${id}-q1`,
            prompt: "Ugaliing uminom ng malinis na _______ araw-araw.",
            choices: ["tubig", "bahay", "paaralan", "araw"],
            answerKey: "tubig",
            points: 1,
          },
          {
            id: `${id}-q2`,
            prompt: "Maagang pumasok ang mga bata sa kanilang _______.",
            choices: ["paaralan", "bulaklak", "tubig", "araw"],
            answerKey: "paaralan",
            points: 1,
          },
          {
            id: `${id}-q3`,
            prompt: "_______ ang buong klase dahil sama-sama silang nagbasa.",
            choices: ["Masaya", "Tubig", "Bahay", "Araw"],
            answerKey: "Masaya",
            points: 1,
          },
        ],
        oralOrObservedPrompt:
          "Itala kung ilang salita mula sa 8 salita sa listahan ang nabasa nang diretso sa unang kita.",
      },
      answerKeySummary: "1. tubig | 2. paaralan | 3. Masaya",
      assessmentRubric:
        "3/3 sa objective items at 7–8/8 sa sight words = Handa na sa susunod na antas; < 2/3 = Ulitin ang sight word drill.",
      successCriteria:
        "Nababasa nang wasto ang 7 sa 8 salita at nakasasagot ng 3/3 sa context clues.",
      suggestedFollowUp:
        "Bigyan ng maikling kuwento na ginagamit ang mga natutuhang salita (Short Stories).",
      resourceAttribution: attribution,
      requiresTeacherReview: false,
      approvedByTeacher: false,
    };
  }

  // Category: Short Stories
  return {
    id,
    title: `Maikling Kuwento at Pag-unawa: "Ang Halaman ni Lila" (Baitang ${params.gradeLevel})`,
    category: "Short Stories",
    skillGapAddressed: sanitizeClinicalLanguage(
      "Pagbasa nang may pag-unawa at pagsagot sa mga tanong tungkol sa tauhan, pangyayari, at aral ng kuwento."
    ),
    reasonForRecommendation: sanitizeClinicalLanguage(params.assessmentReason),
    learningObjective: `Mabasa ang maikling kuwentong angkop sa Baitang ${params.gradeLevel} at masagot nang wasto ang mga tanong sa literal at hinuha na pag-unawa.`,
    teacherInstructions: [
      "Ipakilala muna ang 3 salitang talasalitaan bago ipabasa ang kuwento.",
      "Ipabasa nang malakas o tahimik ang maikling kuwentong 'Ang Halaman ni Lila'.",
      "Pasagutan ang 3 tanong sa pag-unawa at talakayin ang sagot ng mag-aaral.",
    ],
    requiredMaterials: [
      attribution.resourceTitle || "Sipî ng Maikling Kuwento: Ang Halaman ni Lila",
      "Sagutang papel",
    ],
    estimatedMinutes: 25,
    studentExercise: {
      instructions:
        "Basahin nang mabuti ang maikling kuwento at sagutin ang mga tanong sa ibaba.",
      passageTitle: "Ang Halaman ni Lila",
      passageParagraphs: [
        "Si Lila ay may maliit na paso sa tabi ng kanilang bintana. Araw-araw bago pumasok sa paaralan, dinidiligan niya ang tanim na monggo.",
        "Makalipas ang isang linggo, lumabas ang maliliit at berdeng dahon. Tuwang-tuwa si Lila at ipinakita niya ito sa kanyang Nanay.",
      ],
      vocabularyItems: [
        { word: "paso", meaning: "lalagyan ng lupa at tanim na halaman" },
        { word: "dinidiligan", meaning: "binubuhusan ng tubig upang mabuhay ang halaman" },
        { word: "lumabas", meaning: "tumubo o nakita mula sa lupa" },
      ],
      objectiveItems: [
        {
          id: `${id}-q1`,
          prompt: "Sino ang batang nag-aalaga ng halaman sa kuwento?",
          choices: ["Lila", "Nina", "Rosa", "Tomas"],
          answerKey: "Lila",
          points: 1,
        },
        {
          id: `${id}-q2`,
          prompt: "Ano ang ginagawa ni Lila sa kanyang tanim araw-araw bago pumasok sa paaralan?",
          choices: [
            "Dinidiligan niya ito",
            "Pinipitas niya ang dahon",
            "Itinatago niya sa kahon",
            "Binibilad sa ulan",
          ],
          answerKey: "Dinidiligan niya ito",
          points: 1,
        },
        {
          id: `${id}-q3`,
          prompt: "Bakit kaya tumubo ang berdeng dahon ng monggo?",
          choices: [
            "Dahil inalagaan at diniligan ito araw-araw",
            "Dahil hindi ito naarawan",
            "Dahil walang lupa sa paso",
            "Dahil nakalimutan ito ni Lila",
          ],
          answerKey: "Dahil inalagaan at diniligan ito araw-araw",
          points: 1,
        },
      ],
      oralOrObservedPrompt:
        "Ipa-kuwento muli sa mag-aaral sa sarili niyang pangungusap ang simula, gitna, at wakas ng binasa.",
    },
    answerKeySummary:
      "1. Lila | 2. Dinidiligan niya ito | 3. Dahil inalagaan at diniligan ito araw-araw",
    assessmentRubric:
      "3/3 sa tanong at malinaw na naisalaysay muli = Lubos na naunawaan; 2/3 = Katamtaman; 0–1/3 = Kailangan ng guided reading.",
    successCriteria:
      "Nakakukuha ng 3/3 sa mga tanong sa pag-unawa at naibibigay ang pangunahing detalye ng kuwento.",
    suggestedFollowUp:
      "Ipagpatuloy sa susunod na maikling kuwento sa DepEd ARAL KS1 Reading Workbook.",
    resourceAttribution: attribution,
    requiresTeacherReview: true,
    approvedByTeacher: false,
  };
}

export interface GeminiInterventionPromptInput {
  gradeLevel: 1 | 2 | 3;
  assessmentRefs: InterventionAssessmentRef[];
  oralAttempt?: ReadingAttempt | null;
  silentAttempt?: SilentAttempt | null;
  pictureAttempt?: PictureAttempt | null;
  teacherObservations?: string;
  previousCompletedActivities?: Array<{
    title: string;
    category: InterventionCategory;
    finalScore: number;
    maxScore: number;
  }>;
  availableCatalog?: readonly DepEdResource[];
}

/**
 * Construct the minimal, privacy-preserving prompt sent to Gemini.
 * Does NOT include student names, IDs, or personal contact data.
 */
export function buildGeminiInterventionPrompt(input: GeminiInterventionPromptInput): {
  prompt: string;
  relevantCategories: InterventionCategory[];
  defaultSkillGaps: string[];
  filteredResources: DepEdResource[];
} {
  const { categories: relevantCategories, skillGaps: defaultSkillGaps } =
    selectRelevantInterventionCategories({
      gradeLevel: input.gradeLevel,
      assessmentRefs: input.assessmentRefs,
      oralAttempt: input.oralAttempt,
      silentAttempt: input.silentAttempt,
      pictureAttempt: input.pictureAttempt,
      teacherObservations: input.teacherObservations,
    });

  const filteredResources = filterDepEdResources({
    gradeLevel: input.gradeLevel,
    categories: relevantCategories,
    catalog: input.availableCatalog,
  });

  const assessmentSummaryLines = input.assessmentRefs.map(
    (r) =>
      `- ${r.title} (${r.kind}): score ${r.score}/${r.maxScore} [0-16 scale: ${
        r.usesZeroToSixteenThreshold ? "yes" : "no"
      }] -> ${r.remarks}`
  );

  const resourceLines =
    filteredResources.length > 0
      ? filteredResources.map(
          (res) =>
            `- ID: ${res.id} | Title: ${res.title} | Category: ${res.category} | Type: ${res.materialType} | Skill: ${res.literacySkill} | URL: ${res.sourceUrl}`
        )
      : ["- No matching DepEd LR Portal resources found for this filter; generate original grade-appropriate Filipino activities and mark attribution as 'ai-generated-supplementary'."];

  const priorLines =
    input.previousCompletedActivities && input.previousCompletedActivities.length > 0
      ? input.previousCompletedActivities.map(
          (p) => `- ${p.title} (${p.category}): ${p.finalScore}/${p.maxScore}`
        )
      : ["- None recorded"];

  const prompt = `You are a Filipino Grades 1–3 reading specialist designing a targeted Student Reading Intervention Plan.
Return ONLY valid JSON (no markdown fences) matching the schema below.

STRICT RULES:
1. Target Grade Level: Grade ${input.gradeLevel} (Filipino literacy).
2. Recommend ONLY the relevant categories from this allowed subset based on the student's needs: ${JSON.stringify(
    relevantCategories
  )}. Do NOT assign all 4 categories unless all 4 are listed in that subset.
3. Do NOT claim or diagnose any clinical learning disability (no dyslexia, ADHD, autism, or medical diagnosis claims). Describe observable reading skill gaps only.
4. For any "Marungko" activity, strictly follow the official Marungko letter order: ${MARUNGKO_SEQUENCE.join(
    ", "
  )}.
5. Use the approved DepEd LR Portal catalog resources below when matching. Never fabricate URLs; only use "${DEPED_ARAL_LR_PORTAL_URL}" when citing an existing DepEd resource.

ASSESSMENT EVIDENCE:
${assessmentSummaryLines.join("\n")}
Teacher Observations: ${input.teacherObservations || "None provided"}

PREVIOUSLY COMPLETED INTERVENTIONS:
${priorLines.join("\n")}

APPROVED DEPED LR PORTAL CATALOG (SY 2026-2027):
${resourceLines.join("\n")}

REQUIRED JSON SCHEMA:
{
  "skillGaps": ["string"],
  "recommendedCategories": ["Word Recognition" | "Marungko" | "Letter Sounds" | "Short Stories"],
  "learningObjectives": ["string"],
  "schedule": "string",
  "activities": [
    {
      "title": "string",
      "category": "Word Recognition" | "Marungko" | "Letter Sounds" | "Short Stories",
      "skillGapAddressed": "string",
      "reasonForRecommendation": "string",
      "learningObjective": "string",
      "teacherInstructions": ["string"],
      "requiredMaterials": ["string"],
      "estimatedMinutes": 20,
      "matchedDepEdResourceId": "string or null",
      "attributionKind": "existing-deped-material" | "ai-generated-supplementary" | "ai-questions-from-deped-resource",
      "selectionReason": "string",
      "studentExercise": {
        "instructions": "string",
        "wordList": ["string"],
        "marungkoSequenceLetters": ["m", "s", "a", "i", "o", "b"],
        "syllables": ["ma", "sa"],
        "passageTitle": "string",
        "passageParagraphs": ["string"],
        "vocabularyItems": [{"word": "string", "meaning": "string"}],
        "objectiveItems": [
          {
            "id": "q1",
            "prompt": "string",
            "choices": ["string"],
            "answerKey": "string",
            "points": 1
          }
        ],
        "oralOrObservedPrompt": "string"
      },
      "answerKeySummary": "string",
      "assessmentRubric": "string",
      "successCriteria": "string",
      "suggestedFollowUp": "string",
      "requiresTeacherReview": true
    }
  ]
}`;

  return {
    prompt,
    relevantCategories,
    defaultSkillGaps,
    filteredResources,
  };
}

/**
 * Validate and normalize raw Gemini output (or fallback if malformed/empty) into a safe,
 * curriculum-compliant plan structure.
 */
export function validateAndNormalizeGeminiPlan(params: {
  rawJsonText: string | null | undefined;
  gradeLevel: 1 | 2 | 3;
  relevantCategories: InterventionCategory[];
  defaultSkillGaps: string[];
  filteredResources: DepEdResource[];
  assessmentReason: string;
}): {
  skillGaps: string[];
  recommendedCategories: InterventionCategory[];
  learningObjectives: string[];
  schedule: string;
  activities: InterventionPlanActivity[];
  fallbackUsed: boolean;
  warning?: string;
} {
  const buildFallbackResult = (warning: string) => {
    const activities = params.relevantCategories.map((category) =>
      buildDefaultActivityForCategory({
        category,
        gradeLevel: params.gradeLevel,
        assessmentReason: params.assessmentReason,
        availableResources: params.filteredResources,
      })
    );
    return {
      skillGaps: params.defaultSkillGaps.map(sanitizeClinicalLanguage),
      recommendedCategories: params.relevantCategories,
      learningObjectives: activities.map((a) => a.learningObjective),
      schedule: "3 sesyon bawat linggo (20–25 minuto bawat sesyon) sa loob ng 2 linggo",
      activities,
      fallbackUsed: true,
      warning,
    };
  };

  if (!params.rawJsonText || typeof params.rawJsonText !== "string") {
    return buildFallbackResult("Empty response from Gemini API; generated curriculum-aligned fallback plan.");
  }

  let parsed: Record<string, unknown>;
  try {
    const cleaned = params.rawJsonText
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return buildFallbackResult("Malformed JSON returned by Gemini; generated curriculum-aligned fallback plan.");
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.activities) || parsed.activities.length === 0) {
    return buildFallbackResult("Incomplete activity list in Gemini response; generated curriculum-aligned fallback plan.");
  }

  // Enforce only relevant categories (do not allow Gemini to dump all 4 categories if not relevant)
  const allowedCategoriesSet = new Set<InterventionCategory>(params.relevantCategories);
  const normalizedActivities: InterventionPlanActivity[] = [];

  for (let idx = 0; idx < parsed.activities.length; idx++) {
    const rawAct = parsed.activities[idx] as Record<string, unknown>;
    if (!rawAct || typeof rawAct !== "object") continue;

    const rawCategory = String(rawAct.category ?? "") as InterventionCategory;
    if (!SUPPORTED_INTERVENTION_CATEGORIES.includes(rawCategory)) continue;
    if (!allowedCategoriesSet.has(rawCategory)) continue;

    const template = buildDefaultActivityForCategory({
      category: rawCategory,
      gradeLevel: params.gradeLevel,
      assessmentReason: params.assessmentReason,
      availableResources: params.filteredResources,
    });

    const matchedId = typeof rawAct.matchedDepEdResourceId === "string" ? rawAct.matchedDepEdResourceId : undefined;
    const matchedResource =
      params.filteredResources.find((r) => r.id === matchedId) ??
      params.filteredResources.find((r) => r.category === rawCategory && r.gradeLevel === params.gradeLevel) ??
      null;

    const requestedKind = rawAct.attributionKind;
    const validKind =
      requestedKind === "existing-deped-material" ||
      requestedKind === "ai-questions-from-deped-resource" ||
      requestedKind === "ai-generated-supplementary"
        ? requestedKind
        : matchedResource
        ? "existing-deped-material"
        : "ai-generated-supplementary";

    const attribution = buildResourceAttribution(
      matchedResource ? validKind : "ai-generated-supplementary",
      matchedResource,
      typeof rawAct.selectionReason === "string" ? sanitizeClinicalLanguage(rawAct.selectionReason) : undefined
    );

    const rawExercise = (rawAct.studentExercise ?? {}) as Record<string, unknown>;
    const rawObjectiveItems = Array.isArray(rawExercise.objectiveItems)
      ? (rawExercise.objectiveItems as Array<Record<string, unknown>>)
      : [];

    const objectiveItems: InterventionObjectiveItem[] =
      rawObjectiveItems.length > 0
        ? rawObjectiveItems
            .filter((item) => item && typeof item.prompt === "string" && typeof item.answerKey === "string")
            .map((item, qIdx) => ({
              id: typeof item.id === "string" && item.id ? item.id : `act-${idx + 1}-q${qIdx + 1}`,
              prompt: sanitizeClinicalLanguage(String(item.prompt)),
              choices: Array.isArray(item.choices) ? item.choices.map(String) : undefined,
              answerKey: String(item.answerKey).trim(),
              points: typeof item.points === "number" && item.points > 0 ? item.points : 1,
            }))
        : template.studentExercise.objectiveItems;

    let marungkoLetters = Array.isArray(rawExercise.marungkoSequenceLetters)
      ? rawExercise.marungkoSequenceLetters.map(String)
      : template.studentExercise.marungkoSequenceLetters;
    let wordList = Array.isArray(rawExercise.wordList)
      ? rawExercise.wordList.map(String)
      : template.studentExercise.wordList;

    if (rawCategory === "Marungko") {
      const validated = validateMarungkoActivity(marungkoLetters ?? [], wordList ?? []);
      marungkoLetters = validated.normalizedLetters;
      wordList = validated.validWords;
    }

    normalizedActivities.push({
      id: `act-${rawCategory.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      title:
        typeof rawAct.title === "string" && rawAct.title.trim()
          ? sanitizeClinicalLanguage(rawAct.title.trim())
          : template.title,
      category: rawCategory,
      skillGapAddressed:
        typeof rawAct.skillGapAddressed === "string" && rawAct.skillGapAddressed.trim()
          ? sanitizeClinicalLanguage(rawAct.skillGapAddressed.trim())
          : template.skillGapAddressed,
      reasonForRecommendation:
        typeof rawAct.reasonForRecommendation === "string" && rawAct.reasonForRecommendation.trim()
          ? sanitizeClinicalLanguage(rawAct.reasonForRecommendation.trim())
          : template.reasonForRecommendation,
      learningObjective:
        typeof rawAct.learningObjective === "string" && rawAct.learningObjective.trim()
          ? sanitizeClinicalLanguage(rawAct.learningObjective.trim())
          : template.learningObjective,
      teacherInstructions:
        Array.isArray(rawAct.teacherInstructions) && rawAct.teacherInstructions.length > 0
          ? rawAct.teacherInstructions.map((s) => sanitizeClinicalLanguage(String(s)))
          : template.teacherInstructions,
      requiredMaterials:
        Array.isArray(rawAct.requiredMaterials) && rawAct.requiredMaterials.length > 0
          ? rawAct.requiredMaterials.map(String)
          : template.requiredMaterials,
      estimatedMinutes:
        typeof rawAct.estimatedMinutes === "number" && rawAct.estimatedMinutes > 0
          ? rawAct.estimatedMinutes
          : template.estimatedMinutes,
      studentExercise: {
        instructions:
          typeof rawExercise.instructions === "string" && rawExercise.instructions.trim()
            ? sanitizeClinicalLanguage(rawExercise.instructions.trim())
            : template.studentExercise.instructions,
        wordList,
        marungkoSequenceLetters: marungkoLetters,
        syllables: Array.isArray(rawExercise.syllables)
          ? rawExercise.syllables.map(String)
          : template.studentExercise.syllables,
        passageTitle:
          typeof rawExercise.passageTitle === "string"
            ? rawExercise.passageTitle
            : template.studentExercise.passageTitle,
        passageParagraphs:
          Array.isArray(rawExercise.passageParagraphs) && rawExercise.passageParagraphs.length > 0
            ? rawExercise.passageParagraphs.map(String)
            : template.studentExercise.passageParagraphs,
        vocabularyItems: Array.isArray(rawExercise.vocabularyItems)
          ? (rawExercise.vocabularyItems as Array<Record<string, unknown>>)
              .filter((v) => v && typeof v.word === "string" && typeof v.meaning === "string")
              .map((v) => ({ word: String(v.word), meaning: String(v.meaning) }))
          : template.studentExercise.vocabularyItems,
        objectiveItems: objectiveItems.length > 0 ? objectiveItems : template.studentExercise.objectiveItems,
        oralOrObservedPrompt:
          typeof rawExercise.oralOrObservedPrompt === "string"
            ? rawExercise.oralOrObservedPrompt
            : template.studentExercise.oralOrObservedPrompt,
      },
      answerKeySummary:
        typeof rawAct.answerKeySummary === "string" && rawAct.answerKeySummary.trim()
          ? rawAct.answerKeySummary.trim()
          : template.answerKeySummary,
      assessmentRubric:
        typeof rawAct.assessmentRubric === "string" && rawAct.assessmentRubric.trim()
          ? rawAct.assessmentRubric.trim()
          : template.assessmentRubric,
      successCriteria:
        typeof rawAct.successCriteria === "string" && rawAct.successCriteria.trim()
          ? rawAct.successCriteria.trim()
          : template.successCriteria,
      suggestedFollowUp:
        typeof rawAct.suggestedFollowUp === "string" && rawAct.suggestedFollowUp.trim()
          ? rawAct.suggestedFollowUp.trim()
          : template.suggestedFollowUp,
      resourceAttribution: attribution,
      requiresTeacherReview:
        typeof rawAct.requiresTeacherReview === "boolean"
          ? rawAct.requiresTeacherReview
          : template.requiresTeacherReview,
      approvedByTeacher: false,
    });
  }

  if (normalizedActivities.length === 0) {
    return buildFallbackResult(
      "Gemini did not return activities matching the student's relevant categories; generated curriculum-aligned fallback plan."
    );
  }

  const skillGaps =
    Array.isArray(parsed.skillGaps) && parsed.skillGaps.length > 0
      ? parsed.skillGaps.map((s) => sanitizeClinicalLanguage(String(s)))
      : params.defaultSkillGaps.map(sanitizeClinicalLanguage);

  const recommendedCategories = Array.from(
    new Set(normalizedActivities.map((a) => a.category))
  );

  const learningObjectives =
    Array.isArray(parsed.learningObjectives) && parsed.learningObjectives.length > 0
      ? parsed.learningObjectives.map((s) => sanitizeClinicalLanguage(String(s)))
      : normalizedActivities.map((a) => a.learningObjective);

  const schedule =
    typeof parsed.schedule === "string" && parsed.schedule.trim()
      ? parsed.schedule.trim()
      : "3 sesyon bawat linggo (20–25 minuto bawat sesyon) sa loob ng 2 linggo";

  return {
    skillGaps,
    recommendedCategories,
    learningObjectives,
    schedule,
    activities: normalizedActivities,
    fallbackUsed: false,
  };
}

/**
 * Generate a complete InterventionPlan draft using the server-side Gemini endpoint
 * with automatic validation, DepEd LR Portal attribution, and safe fallback on error/timeout.
 */
export async function generateInterventionPlanWithGemini(params: {
  learner: Learner;
  teacher: TeacherAccessContext;
  assessmentRefs: InterventionAssessmentRef[];
  oralAttempt?: ReadingAttempt | null;
  silentAttempt?: SilentAttempt | null;
  pictureAttempt?: PictureAttempt | null;
  teacherObservations?: string;
  existingPlans?: InterventionPlan[];
  isFollowUp?: boolean;
  followUpFromPlanId?: string;
  availableCatalog?: readonly DepEdResource[];
  geminiCaller?: (
    prompt: string
  ) => Promise<{ text?: string; outputText?: string; model: string }>;
}): Promise<InterventionPlan> {
  const accessCheck = assertTeacherCanAccessLearner(params.teacher, params.learner);
  if (!accessCheck.allowed || !accessCheck.gradeLevel) {
    throw new Error(accessCheck.reason ?? "Access denied.");
  }

  const duplicateCheck = canCreateInterventionPlan({
    existingPlans: params.existingPlans ?? [],
    learnerId: params.learner.id,
    assessmentIds: params.assessmentRefs.map((r) => r.id),
    isFollowUp: params.isFollowUp,
  });
  if (!duplicateCheck.allowed) {
    throw new Error(duplicateCheck.reason ?? "Duplicate active plan exists.");
  }

  const previousCompletedActivities: Array<{
    title: string;
    category: InterventionCategory;
    finalScore: number;
    maxScore: number;
  }> = [];

  for (const plan of params.existingPlans ?? []) {
    for (const act of plan.activities) {
      if (act.result) {
        previousCompletedActivities.push({
          title: act.title,
          category: act.category,
          finalScore: act.result.finalScore,
          maxScore: act.result.maxScore,
        });
      }
    }
  }

  const promptInfo = buildGeminiInterventionPrompt({
    gradeLevel: accessCheck.gradeLevel,
    assessmentRefs: params.assessmentRefs,
    oralAttempt: params.oralAttempt,
    silentAttempt: params.silentAttempt,
    pictureAttempt: params.pictureAttempt,
    teacherObservations: params.teacherObservations,
    previousCompletedActivities,
    availableCatalog: params.availableCatalog ?? DEPED_LR_CATALOG,
  });

  const assessmentReason =
    params.assessmentRefs.map((r) => `${r.title} (${r.score}/${r.maxScore})`).join("; ") ||
    "Batay sa pagsusuri ng guro sa pagbasa.";

  let rawText: string | null = null;
  let modelName = "models/gemini-3.8-flash";
  let apiErrorWarning: string | undefined;

  const caller = params.geminiCaller ?? callGeminiInterventionEndpoint;
  try {
    const res = await caller(promptInfo.prompt);
    rawText = res.text ?? res.outputText ?? null;
    modelName = res.model || modelName;
  } catch (err) {
    apiErrorWarning =
      err instanceof Error
        ? `Gemini API unavailable (${err.message}); used curriculum-aligned fallback generator.`
        : "Gemini API unavailable; used curriculum-aligned fallback generator.";
  }

  const normalized = validateAndNormalizeGeminiPlan({
    rawJsonText: rawText,
    gradeLevel: accessCheck.gradeLevel,
    relevantCategories: promptInfo.relevantCategories,
    defaultSkillGaps: promptInfo.defaultSkillGaps,
    filteredResources: promptInfo.filteredResources,
    assessmentReason,
  });

  const now = new Date().toISOString();
  const sectionObj = INTERVENTION_SECTIONS.find((s) => s.id === params.learner.sectionId);
  const sectionLabel = sectionObj
    ? `${sectionObj.name} (${sectionObj.grade})`
    : params.learner.grade ?? `Grade ${accessCheck.gradeLevel}`;

  const auditEntry: InterventionAuditEntry = {
    id: `audit-${Date.now()}`,
    timestamp: now,
    actor: params.teacher.teacherId,
    action: params.isFollowUp ? "follow-up-created" : "plan-created",
    summary: params.isFollowUp
      ? `Created follow-up intervention plan (${normalized.recommendedCategories.join(", ")}).`
      : `Created intervention plan draft (${normalized.recommendedCategories.join(", ")}).`,
  };

  return {
    id: `iplan-${params.learner.id}-${Date.now()}`,
    learnerId: params.learner.id,
    gradeLevel: accessCheck.gradeLevel,
    sectionId: params.learner.sectionId || "sampaguita",
    sectionLabel,
    createdByTeacherId: params.teacher.teacherId,
    status: "Draft",
    assessmentRefs: params.assessmentRefs,
    skillGaps: normalized.skillGaps,
    recommendedCategories: normalized.recommendedCategories,
    learningObjectives: normalized.learningObjectives,
    schedule: normalized.schedule,
    activities: normalized.activities,
    teacherNotes: params.teacherObservations ?? "",
    followUpFromPlanId: params.followUpFromPlanId,
    aiMetadata: {
      model: modelName,
      generatedAt: now,
      fallbackUsed: normalized.fallbackUsed,
      warning: apiErrorWarning ?? normalized.warning,
    },
    auditLog: [auditEntry],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Automatically grade objective items in an intervention activity when an answer key exists.
 * Does NOT overwrite baseline assessment records.
 */
export function gradeInterventionActivityObjective(
  activity: InterventionPlanActivity,
  studentResponses: Record<string, string>
): InterventionActivityResult {
  const items = activity.studentExercise.objectiveItems;
  let score = 0;
  let maxScore = 0;

  for (const item of items) {
    const pts = item.points > 0 ? item.points : 1;
    maxScore += pts;
    const given = (studentResponses[item.id] ?? "").trim().toLowerCase();
    const expected = item.answerKey.trim().toLowerCase();
    if (given && given === expected) {
      score += pts;
    }
  }

  if (maxScore === 0) {
    maxScore = 1;
  }

  const pct = Math.round((score / maxScore) * 100);
  const remarks =
    pct >= 80
      ? `Auto-graded: ${score}/${maxScore} (${pct}%) — Naabot ang pamantayan sa pagsasanay.`
      : `Auto-graded: ${score}/${maxScore} (${pct}%) — Nangangailangan pa ng karagdagang paggabay.`;

  return {
    completedAt: new Date().toISOString(),
    studentResponses: { ...studentResponses },
    autoCalculatedScore: score,
    finalScore: score,
    maxScore,
    gradingMode: "auto-graded",
    remarks,
  };
}

/**
 * Record automatic grading on a specific activity inside an InterventionPlan, returning a new
 * updated plan object with an audit trail entry.
 */
export function recordActivityAutoGrade(
  plan: InterventionPlan,
  activityId: string,
  studentResponses: Record<string, string>,
  actor = plan.createdByTeacherId
): InterventionPlan {
  const now = new Date().toISOString();
  let updatedTitle = activityId;
  let resultSummary = "";

  const activities = plan.activities.map((act) => {
    if (act.id !== activityId) return act;
    updatedTitle = act.title;
    const result = gradeInterventionActivityObjective(act, studentResponses);
    resultSummary = `${result.finalScore}/${result.maxScore}`;
    return {
      ...act,
      result,
    };
  });

  const auditEntry: InterventionAuditEntry = {
    id: `audit-${Date.now()}-auto`,
    timestamp: now,
    actor,
    action: "activity-auto-graded",
    summary: `Auto-graded '${updatedTitle}': ${resultSummary}.`,
  };

  return {
    ...plan,
    activities,
    auditLog: [...plan.auditLog, auditEntry],
    updatedAt: now,
  };
}

export interface TeacherActivityReviewInput {
  finalScore: number;
  maxScore?: number;
  teacherComment?: string;
  remarks?: string;
  reviewedBy: string;
}

/**
 * Apply teacher review or score adjustment/correction to an intervention activity.
 * Clearly distinguishes between "teacher-reviewed" (confirming auto-grade or grading oral task)
 * and "teacher-corrected" (overriding the auto-calculated score), while keeping an audit log.
 */
export function applyTeacherActivityReview(
  plan: InterventionPlan,
  activityId: string,
  review: TeacherActivityReviewInput
): InterventionPlan {
  const now = new Date().toISOString();
  let auditAction: InterventionAuditEntry["action"] = "activity-teacher-reviewed";
  let auditSummary = "";

  const activities = plan.activities.map((act) => {
    if (act.id !== activityId) return act;

    const existingResult = act.result;
    const maxScore =
      review.maxScore && review.maxScore > 0
        ? review.maxScore
        : existingResult?.maxScore ??
          (act.studentExercise.objectiveItems.reduce((acc, i) => acc + (i.points || 1), 0) || 10);

    const clampedScore = Math.max(0, Math.min(maxScore, review.finalScore));
    const wasOverridden =
      existingResult?.autoCalculatedScore !== undefined &&
      existingResult.autoCalculatedScore !== clampedScore;

    const gradingMode = wasOverridden ? "teacher-corrected" : "teacher-reviewed";
    auditAction = wasOverridden ? "activity-teacher-corrected" : "activity-teacher-reviewed";

    const remarks =
      review.remarks ||
      (wasOverridden
        ? `Teacher-corrected score: ${clampedScore}/${maxScore} (from auto-graded ${existingResult?.autoCalculatedScore}/${maxScore}).`
        : `Teacher-reviewed score: ${clampedScore}/${maxScore}.`);

    auditSummary = `${wasOverridden ? "Adjusted" : "Reviewed"} '${act.title}' score to ${clampedScore}/${maxScore}${
      review.teacherComment ? ` — "${review.teacherComment}"` : ""
    }.`;

    const updatedResult: InterventionActivityResult = {
      completedAt: existingResult?.completedAt ?? now,
      studentResponses: existingResult?.studentResponses,
      autoCalculatedScore: existingResult?.autoCalculatedScore,
      finalScore: clampedScore,
      maxScore,
      gradingMode,
      remarks,
      teacherComment: review.teacherComment,
      reviewedBy: review.reviewedBy,
    };

    return {
      ...act,
      approvedByTeacher: true,
      result: updatedResult,
    };
  });

  const auditEntry: InterventionAuditEntry = {
    id: `audit-${Date.now()}-rev`,
    timestamp: now,
    actor: review.reviewedBy,
    action: auditAction,
    summary: auditSummary || `Teacher reviewed activity ${activityId}.`,
  };

  return {
    ...plan,
    activities,
    auditLog: [...plan.auditLog, auditEntry],
    updatedAt: now,
  };
}

/**
 * Transition an InterventionPlan's status (Draft -> Pending Review -> Approved -> In Progress -> Completed)
 * and record the transition in the audit log.
 */
export function updateInterventionPlanStatus(
  plan: InterventionPlan,
  newStatus: InterventionPlanStatus,
  actor: string,
  note?: string
): InterventionPlan {
  const now = new Date().toISOString();
  const auditEntry: InterventionAuditEntry = {
    id: `audit-${Date.now()}-status`,
    timestamp: now,
    actor,
    action: "status-changed",
    summary: `Changed status from '${plan.status}' to '${newStatus}'${note ? `: ${note}` : ""}.`,
  };

  return {
    ...plan,
    status: newStatus,
    approvedAt: newStatus === "Approved" ? now : plan.approvedAt,
    completedAt: newStatus === "Completed" ? now : plan.completedAt,
    activities:
      newStatus === "Approved"
        ? plan.activities.map((a) => ({ ...a, approvedByTeacher: true }))
        : plan.activities,
    auditLog: [...plan.auditLog, auditEntry],
    updatedAt: now,
  };
}
