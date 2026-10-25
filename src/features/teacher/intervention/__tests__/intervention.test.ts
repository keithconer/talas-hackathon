import { describe, expect, it } from "vitest";
import {
  applyTeacherActivityReview,
  assertTeacherCanAccessLearner,
  canCreateInterventionPlan,
  DEFAULT_TEACHER_ACCESS,
  evaluateAssessmentEligibility,
  generateInterventionPlanWithGemini,
  gradeInterventionActivityObjective,
  isGradeEligibleForIntervention,
  MARUNGKO_SEQUENCE,
  parseGradeLevel,
  recordActivityAutoGrade,
  sanitizeClinicalLanguage,
  selectRelevantInterventionCategories,
  updateInterventionPlanStatus,
  validateMarungkoActivity,
} from "../interventionEngine";
import {
  DEPED_ARAL_LR_PORTAL_URL,
  DEPED_LR_CATALOG,
  filterDepEdResources,
} from "../depedCatalog";
import {
  getRecord,
  listInterventionPlansByLearner,
  listScreeningAssessmentsByLearner,
  putRecord,
} from "../../../../data/repository";
import {
  STORES,
  type InterventionAssessmentRef,
  type Learner,
  type ReadingAttempt,
  type ScreeningAssessment,
} from "../../../../data/types";

const sampleGrade1Learner: Learner = {
  id: "1001",
  name: "Mateo Cruz",
  initials: "MC",
  grade: "Grade 1",
  sectionId: "sampaguita",
  level: "FR",
  status: "For Assessment",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("Student Reading Intervention System (Grades 1–3)", () => {
  // 1. Score of 0
  it("1. identifies a screening score of 0 (on the 0–16 threshold scale) as eligible", () => {
    const res = evaluateAssessmentEligibility({
      id: "scr-0",
      kind: "screening",
      title: "ARAL Screening",
      date: "2026-10-20T00:00:00.000Z",
      score: 0,
      maxScore: 20,
      usesZeroToSixteenThreshold: true,
    });
    expect(res.valid).toBe(true);
    expect(res.eligible).toBe(true);
    expect(res.statusLabel).toBe("Eligible (0–16 Scale)");
  });

  // 2. Score of 16
  it("2. identifies a screening score of 16 (inclusive upper bound) as eligible", () => {
    const res = evaluateAssessmentEligibility({
      id: "scr-16",
      kind: "screening",
      title: "ARAL Screening",
      date: "2026-10-20T00:00:00.000Z",
      score: 16,
      maxScore: 20,
      usesZeroToSixteenThreshold: true,
    });
    expect(res.valid).toBe(true);
    expect(res.eligible).toBe(true);
    expect(res.statusLabel).toBe("Eligible (0–16 Scale)");
  });

  // 3. Score of 17
  it("3. identifies a screening score of 17 as NOT eligible for intervention", () => {
    const res = evaluateAssessmentEligibility({
      id: "scr-17",
      kind: "screening",
      title: "ARAL Screening",
      date: "2026-10-20T00:00:00.000Z",
      score: 17,
      maxScore: 20,
      usesZeroToSixteenThreshold: true,
    });
    expect(res.valid).toBe(true);
    expect(res.eligible).toBe(false);
    expect(res.statusLabel).toBe("Not Eligible");
  });

  // 4. Missing, null, or ungraded scores
  it("4. does NOT treat missing, null, undefined, NaN, or out-of-range scores as zero or eligible", () => {
    for (const badScore of [null, undefined, Number.NaN, -1, 25]) {
      const res = evaluateAssessmentEligibility({
        id: "scr-bad",
        kind: "screening",
        title: "ARAL Screening",
        date: "2026-10-20T00:00:00.000Z",
        score: badScore,
        maxScore: 20,
        usesZeroToSixteenThreshold: true,
      });
      expect(res.valid).toBe(false);
      expect(res.eligible).toBe(false);
      expect(res.statusLabel).toBe("Ungraded / Invalid");
    }
  });

  // 5. Assessments with different maximum scores
  it("5. evaluates assessments with different maximum scores using their own scale rules instead of raw 0–16 comparison", () => {
    // Silent reading 4/4 (score 4 is numerically <= 16, but 4/4 is 100% Grade Ready!)
    const silentPerfect = evaluateAssessmentEligibility({
      id: "sil-1",
      kind: "silent",
      title: "Silent Reading",
      date: "2026-10-20T00:00:00.000Z",
      score: 4,
      maxScore: 4,
      usesZeroToSixteenThreshold: false,
      crlaProfile: "GR",
    });
    expect(silentPerfect.eligible).toBe(false);

    // Salita at Larawan 5/5 (separate practice activity on 5-point scale)
    const picturePerfect = evaluateAssessmentEligibility({
      id: "pic-1",
      kind: "picture",
      title: "Salita at Larawan",
      date: "2026-10-20T00:00:00.000Z",
      score: 5,
      maxScore: 5,
      usesZeroToSixteenThreshold: false,
    });
    expect(picturePerfect.eligible).toBe(false);

    // Oral reading with 68% accuracy (score 68 > 16 numerically, but Full Refresher on CRLA 100-point scale!)
    const oralStruggling = evaluateAssessmentEligibility({
      id: "oral-1",
      kind: "oral",
      title: "Oral Reading",
      date: "2026-10-20T00:00:00.000Z",
      score: 68,
      maxScore: 100,
      usesZeroToSixteenThreshold: false,
      crlaProfile: "FR",
    });
    expect(oralStruggling.eligible).toBe(true);
    expect(oralStruggling.statusLabel).toBe("Eligible (CRLA Refresher)");
  });

  // 6. Grade 1, Grade 2, and Grade 3 inclusion
  it("6. includes Grade 1, Grade 2, and Grade 3 learners", () => {
    expect(parseGradeLevel("Grade 1")).toBe(1);
    expect(parseGradeLevel("Grade 2")).toBe(2);
    expect(parseGradeLevel("Grade 3")).toBe(3);
    expect(parseGradeLevel("Baitang 2")).toBe(2);
    expect(isGradeEligibleForIntervention("Grade 1")).toBe(true);
    expect(isGradeEligibleForIntervention("Grade 2")).toBe(true);
    expect(isGradeEligibleForIntervention("Grade 3")).toBe(true);
  });

  // 7. Exclusion of non-target grade levels
  it("7. excludes learners outside Grades 1–3 (e.g., Kinder, Grade 4, Grade 5, Grade 6)", () => {
    for (const nonTarget of ["Kinder", "Grade 4", "Grade 5", "Grade 6", "Grade 7", ""]) {
      expect(parseGradeLevel(nonTarget)).toBeNull();
      expect(isGradeEligibleForIntervention(nonTarget)).toBe(false);
    }

    const grade4Check = assertTeacherCanAccessLearner(DEFAULT_TEACHER_ACCESS, {
      id: "9999",
      name: "Grade 4 Student",
      grade: "Grade 4",
      sectionId: "sampaguita",
    });
    expect(grade4Check.allowed).toBe(false);
  });

  // 8. Recommendation of only relevant categories + Marungko sequence validation
  it("8. recommends ONLY relevant categories based on student needs and enforces Marungko letter order", () => {
    // Student with mild comprehension need (score 15/20) -> only Short Stories
    const compOnly = selectRelevantInterventionCategories({
      gradeLevel: 3,
      assessmentRefs: [
        {
          id: "scr-15",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 15,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Needs comprehension support",
        },
      ],
    });
    expect(compOnly.categories).toEqual(["Short Stories"]);
    expect(compOnly.categories.length).toBeLessThan(4);

    // Marungko validation enforces official sequence (m, s, a, i, o, b...)
    expect(MARUNGKO_SEQUENCE.slice(0, 6)).toEqual(["m", "s", "a", "i", "o", "b"]);
    const marungkoCheck = validateMarungkoActivity(
      ["b", "a", "m", "s", "i", "o"],
      ["mama", "masa", "aso", "basa", "zebra"]
    );
    expect(marungkoCheck.normalizedLetters).toEqual(["m", "s", "a", "i", "o", "b"]);
    expect(marungkoCheck.validWords).not.toContain("zebra");
    expect(marungkoCheck.validWords).toContain("mama");
  });

  // 9. DepEd LR Portal resource matching when a suitable resource exists
  it("9. matches approved DepEd LR Portal ARAL resources when available and preserves official portal URL", async () => {
    const matched = filterDepEdResources({
      gradeLevel: 1,
      categories: ["Marungko"],
    });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched[0].sourceUrl).toBe(DEPED_ARAL_LR_PORTAL_URL);

    const plan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: "scr-1",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 6,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Foundational need",
        },
      ],
      availableCatalog: DEPED_LR_CATALOG,
      geminiCaller: async () => ({
        model: "models/gemini-3.8-flash",
        text: JSON.stringify({
          skillGaps: ["Nahihirapan sa pagkilala ng tunog ng titik m, s, a, i, o, b"],
          recommendedCategories: ["Marungko"],
          learningObjectives: ["Makabasa ng pantig sa Marungko sequence"],
          schedule: "3x a week",
          activities: [
            {
              title: "Pagsasanay sa Marungko",
              category: "Marungko",
              skillGapAddressed: "Tunog at pantig",
              reasonForRecommendation: "Scored 6/20 on screening",
              learningObjective: "Makabasa ng ma, sa, ba",
              teacherInstructions: ["Ipakita ang titik m, s, a, i, o, b"],
              requiredMaterials: ["Flashcards"],
              estimatedMinutes: 20,
              matchedDepEdResourceId: "deped-aral-ks1-g1-marungko-wb",
              attributionKind: "existing-deped-material",
              studentExercise: {
                instructions: "Basahin ang mga salita",
                marungkoSequenceLetters: ["m", "s", "a", "i", "o", "b"],
                wordList: ["mama", "masa", "sama", "aso", "basa"],
                objectiveItems: [
                  {
                    id: "q1",
                    prompt: "ma + sa = ?",
                    choices: ["masa", "basa"],
                    answerKey: "masa",
                    points: 1,
                  },
                ],
              },
              answerKeySummary: "1. masa",
              assessmentRubric: "1/1",
              successCriteria: "100%",
              suggestedFollowUp: "Next letters",
              requiresTeacherReview: true,
            },
          ],
        }),
      }),
    });

    expect(plan.activities[0].resourceAttribution.kind).toBe("existing-deped-material");
    expect(plan.activities[0].resourceAttribution.sourceUrl).toBe(DEPED_ARAL_LR_PORTAL_URL);
    expect(plan.activities[0].resourceAttribution.resourceId).toBe(
      "deped-aral-ks1-g1-marungko-wb"
    );
  });

  // 10. Fallback to AI-generated original activities when no matching DepEd resource exists
  it("10. labels activities as 'ai-generated-supplementary' without fabricating DepEd URLs when no DepEd catalog match exists", async () => {
    const plan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: "scr-2",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 7,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Foundational need",
        },
      ],
      availableCatalog: [], // Empty catalog -> no matching DepEd resource
      geminiCaller: async () => ({
        model: "models/gemini-3.8-flash",
        text: JSON.stringify({
          skillGaps: ["Pagkilala sa tunog ng titik"],
          recommendedCategories: ["Letter Sounds"],
          learningObjectives: ["Matukoy ang unang tunog"],
          schedule: "3x a week",
          activities: [
            {
              title: "Pagsasanay sa Tunog",
              category: "Letter Sounds",
              skillGapAddressed: "Unang tunog",
              reasonForRecommendation: "7/20 screening",
              learningObjective: "Matukoy ang unang titik",
              teacherInstructions: ["Ipabigkas ang salita"],
              requiredMaterials: ["Flashcards"],
              estimatedMinutes: 15,
              matchedDepEdResourceId: "fake-id",
              attributionKind: "existing-deped-material",
              studentExercise: {
                instructions: "Piliin ang unang titik",
                objectiveItems: [
                  {
                    id: "q1",
                    prompt: "Unang titik ng bola?",
                    choices: ["b", "m"],
                    answerKey: "b",
                    points: 1,
                  },
                ],
              },
              answerKeySummary: "1. b",
              assessmentRubric: "1/1",
              successCriteria: "1/1",
              suggestedFollowUp: "Marungko",
              requiresTeacherReview: false,
            },
          ],
        }),
      }),
    });

    expect(plan.activities[0].resourceAttribution.kind).toBe("ai-generated-supplementary");
    expect(plan.activities[0].resourceAttribution.sourceUrl).toBeUndefined();
    expect(plan.activities[0].resourceAttribution.label).toContain(
      "Not an Official DepEd File"
    );
  });

  // 11. Gemini failure, timeout, or malformed response (+ clinical diagnosis sanitization)
  it("11. handles Gemini failure, timeout, or malformed JSON gracefully using curriculum-aligned fallback and strips clinical diagnosis claims", async () => {
    const planOnTimeout = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: "scr-timeout",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 10,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Needs support",
        },
      ],
      geminiCaller: async () => {
        throw new Error("Request timed out after 10000ms");
      },
    });

    expect(planOnTimeout.aiMetadata?.fallbackUsed).toBe(true);
    expect(planOnTimeout.aiMetadata?.warning).toContain("Request timed out");
    expect(planOnTimeout.activities.length).toBeGreaterThan(0);

    const planOnMalformed = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: "scr-malformed",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 10,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Needs support",
        },
      ],
      geminiCaller: async () => ({
        model: "models/gemini-3.8-flash",
        text: "{not-valid-json",
      }),
    });

    expect(planOnMalformed.aiMetadata?.fallbackUsed).toBe(true);
    expect(planOnMalformed.activities.length).toBeGreaterThan(0);

    // Clinical diagnosis claims are stripped
    const sanitized = sanitizeClinicalLanguage(
      "Student shows signs of dyslexia and learning disability."
    );
    expect(sanitized.toLowerCase()).not.toContain("dyslexia");
    expect(sanitized.toLowerCase()).not.toContain("learning disability");
  });

  // 12. Prevention of duplicate active intervention plans
  it("12. prevents duplicate active intervention plans for the same student and assessment unless explicitly marked as a follow-up plan", async () => {
    const assessmentRefs: InterventionAssessmentRef[] = [
      {
        id: "scr-dup-1",
        kind: "screening",
        title: "Screening",
        date: "2026-10-20T00:00:00.000Z",
        score: 11,
        maxScore: 20,
        usesZeroToSixteenThreshold: true,
        eligibleTrigger: true,
        remarks: "Eligible",
      },
    ];

    const firstPlan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs,
      geminiCaller: async () => {
        throw new Error("offline");
      },
    });

    // Attempting a second active plan for the same learner + assessment throws / blocks
    const dupCheck = canCreateInterventionPlan({
      existingPlans: [firstPlan],
      learnerId: sampleGrade1Learner.id,
      assessmentIds: ["scr-dup-1"],
      isFollowUp: false,
    });
    expect(dupCheck.allowed).toBe(false);

    await expect(
      generateInterventionPlanWithGemini({
        learner: sampleGrade1Learner,
        teacher: DEFAULT_TEACHER_ACCESS,
        assessmentRefs,
        existingPlans: [firstPlan],
        isFollowUp: false,
      })
    ).rejects.toThrow(/active intervention plan/i);

    // Explicit follow-up plan is allowed
    const followUpPlan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs,
      existingPlans: [firstPlan],
      isFollowUp: true,
      followUpFromPlanId: firstPlan.id,
      geminiCaller: async () => {
        throw new Error("offline");
      },
    });
    expect(followUpPlan.followUpFromPlanId).toBe(firstPlan.id);
  });

  // 13. Unauthorized access to another teacher's student records
  it("13. blocks unauthenticated users or teachers accessing students outside their assigned sections", async () => {
    // Unauthenticated teacher
    const unauthCheck = assertTeacherCanAccessLearner(
      {
        teacherId: "teacher-maria",
        isAuthenticated: false,
        authorizedSectionIds: ["sampaguita"],
      },
      sampleGrade1Learner
    );
    expect(unauthCheck.allowed).toBe(false);

    // Authenticated teacher who only owns section 'rosal' trying to access 'sampaguita' student
    const otherTeacher = {
      teacherId: "teacher-pedro",
      isAuthenticated: true,
      authorizedSectionIds: ["rosal"],
    };
    const crossSectionCheck = assertTeacherCanAccessLearner(
      otherTeacher,
      sampleGrade1Learner
    );
    expect(crossSectionCheck.allowed).toBe(false);

    await expect(
      generateInterventionPlanWithGemini({
        learner: sampleGrade1Learner,
        teacher: otherTeacher,
        assessmentRefs: [],
      })
    ).rejects.toThrow(/Unauthorized/i);
  });

  // 14. Automatic grading of objective intervention activities
  it("14. automatically grades objective intervention items using the answer key and logs 'auto-graded'", async () => {
    const plan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: "scr-grade",
          kind: "screening",
          title: "Screening",
          date: "2026-10-20T00:00:00.000Z",
          score: 8,
          maxScore: 20,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Eligible",
        },
      ],
      geminiCaller: async () => {
        throw new Error("offline");
      },
    });

    const activity = plan.activities[0];
    const items = activity.studentExercise.objectiveItems;
    expect(items.length).toBeGreaterThanOrEqual(2);

    // Answer the first item right and the second item wrong
    const responses: Record<string, string> = {
      [items[0].id]: items[0].answerKey,
      [items[1].id]: "wrong-answer",
    };

    const directResult = gradeInterventionActivityObjective(activity, responses);
    expect(directResult.gradingMode).toBe("auto-graded");
    expect(directResult.autoCalculatedScore).toBe(items[0].points);
    expect(directResult.finalScore).toBe(items[0].points);

    const updatedPlan = recordActivityAutoGrade(
      plan,
      activity.id,
      responses,
      "teacher-maria"
    );
    const updatedAct = updatedPlan.activities.find((a) => a.id === activity.id)!;
    expect(updatedAct.result?.gradingMode).toBe("auto-graded");
    expect(
      updatedPlan.auditLog.some((e) => e.action === "activity-auto-graded")
    ).toBe(true);
  });

  // 15. Teacher score adjustment, approval workflow, and non-mutation of baseline assessments
  it("15. supports teacher score adjustment ('teacher-corrected'), plan status transitions, and preserves original assessment records in IndexedDB", async () => {
    // Seed a baseline oral reading attempt and screening assessment in IndexedDB
    const baselineOral: ReadingAttempt = {
      id: "oral-base-1001",
      learnerId: "1001",
      passageId: "p-1",
      transcript: "Ang aso ni Tomas",
      accuracy: 65,
      totalWords: 40,
      correctWords: 26,
      words: [],
      method: "speech-api",
      online: true,
      durationSec: 45,
      createdAt: "2026-10-15T00:00:00.000Z",
      updatedAt: "2026-10-15T00:00:00.000Z",
    };
    const baselineScreening: ScreeningAssessment = {
      id: "scr-base-1001",
      learnerId: "1001",
      sectionId: "sampaguita",
      grade: "Grade 1",
      assessmentName: "ARAL Screening",
      score: 12,
      maxScore: 20,
      usesZeroToSixteenThreshold: true,
      assessedBy: "teacher-maria",
      createdAt: "2026-10-16T00:00:00.000Z",
      updatedAt: "2026-10-16T00:00:00.000Z",
    };

    await putRecord(STORES.readingAttempts, baselineOral);
    await putRecord(STORES.screeningAssessments, baselineScreening);

    const plan = await generateInterventionPlanWithGemini({
      learner: sampleGrade1Learner,
      teacher: DEFAULT_TEACHER_ACCESS,
      assessmentRefs: [
        {
          id: baselineScreening.id,
          kind: "screening",
          title: baselineScreening.assessmentName,
          date: baselineScreening.createdAt,
          score: baselineScreening.score,
          maxScore: baselineScreening.maxScore,
          usesZeroToSixteenThreshold: true,
          eligibleTrigger: true,
          remarks: "Eligible",
        },
      ],
      oralAttempt: baselineOral,
      geminiCaller: async () => {
        throw new Error("offline");
      },
    });

    const actId = plan.activities[0].id;
    const autoPlan = recordActivityAutoGrade(plan, actId, {}, "teacher-maria");
    expect(autoPlan.activities[0].result?.finalScore).toBe(0);

    // Teacher adjusts score to 3/3 with comment
    const reviewedPlan = applyTeacherActivityReview(autoPlan, actId, {
      finalScore: 3,
      maxScore: 3,
      teacherComment: "Nabasa nang malinaw sa oral recitation.",
      reviewedBy: "teacher-maria",
    });

    const reviewedAct = reviewedPlan.activities[0];
    expect(reviewedAct.approvedByTeacher).toBe(true);
    expect(reviewedAct.result?.gradingMode).toBe("teacher-corrected");
    expect(reviewedAct.result?.autoCalculatedScore).toBe(0);
    expect(reviewedAct.result?.finalScore).toBe(3);
    expect(reviewedAct.result?.teacherComment).toBe(
      "Nabasa nang malinaw sa oral recitation."
    );

    // Status transitions: Draft -> Approved -> Completed
    const approvedPlan = updateInterventionPlanStatus(
      reviewedPlan,
      "Approved",
      "teacher-maria"
    );
    expect(approvedPlan.status).toBe("Approved");
    expect(approvedPlan.approvedAt).toBeDefined();

    const completedPlan = updateInterventionPlanStatus(
      approvedPlan,
      "Completed",
      "teacher-maria"
    );
    expect(completedPlan.status).toBe("Completed");
    expect(completedPlan.completedAt).toBeDefined();

    await putRecord(STORES.interventionPlans, completedPlan);

    // Verify persistence and that baseline records were NOT overwritten
    const storedPlans = await listInterventionPlansByLearner("1001");
    expect(storedPlans).toHaveLength(1);
    expect(storedPlans[0].status).toBe("Completed");

    const storedScreenings = await listScreeningAssessmentsByLearner("1001");
    expect(storedScreenings).toHaveLength(1);
    expect(storedScreenings[0].score).toBe(12);

    const storedOral = await getRecord(STORES.readingAttempts, baselineOral.id);
    expect(storedOral?.accuracy).toBe(65);
  });
});

