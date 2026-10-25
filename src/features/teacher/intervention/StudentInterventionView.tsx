import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  History,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  getRecord,
  listInterventionPlansByLearner,
  listPictureAttemptsByLearner,
  listReadingAttemptsByLearner,
  listScreeningAssessmentsByLearner,
  listSilentAttemptsByLearner,
  putRecord,
  softDelete,
} from "../../../data/repository";
import { syncNow } from "../../../data/syncController";
import {
  STORES,
  type InterventionPlan,
  type InterventionPlanActivity,
  type InterventionPlanStatus,
  type Learner,
  type PictureAttempt,
  type ReadingAttempt,
  type ScreeningAssessment,
  type SilentAttempt,
} from "../../../data/types";
import { isTeacherAuthed } from "../../auth/teacherSession";
import { LEARNERS } from "../dashboard/sectionData";
import {
  applyTeacherActivityReview,
  assertTeacherCanAccessLearner,
  buildStudentInterventionSummary,
  canCreateInterventionPlan,
  DEFAULT_TEACHER_ACCESS,
  generateInterventionPlanWithGemini,
  recordActivityAutoGrade,
  updateInterventionPlanStatus,
} from "./interventionEngine";

const STATUS_STEPS: InterventionPlanStatus[] = [
  "Draft",
  "Pending Review",
  "Approved",
  "In Progress",
  "Completed",
];

export default function StudentInterventionView() {
  const { learnerId } = useParams<{ learnerId: string }>();
  const navigate = useNavigate();

  const [learner, setLearner] = useState<Learner | null>(null);
  const [screenings, setScreenings] = useState<ScreeningAssessment[]>([]);
  const [oralAttempts, setOralAttempts] = useState<ReadingAttempt[]>([]);
  const [silentAttempts, setSilentAttempts] = useState<SilentAttempt[]>([]);
  const [pictureAttempts, setPictureAttempts] = useState<PictureAttempt[]>([]);
  const [plans, setPlans] = useState<InterventionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Plan creation state
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[] | null>(null);
  const [teacherObservations, setTeacherObservations] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Plan editing state
  const [editingPlanMeta, setEditingPlanMeta] = useState(false);
  const [draftSchedule, setDraftSchedule] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftFollowUpSummary, setDraftFollowUpSummary] = useState("");

  // Activity interactive grading & teacher review state
  const [studentAnswersByActivity, setStudentAnswersByActivity] = useState<
    Record<string, Record<string, string>>
  >({});
  const [teacherScoreInput, setTeacherScoreInput] = useState<Record<string, string>>({});
  const [teacherCommentInput, setTeacherCommentInput] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function readLocal() {
      if (!learnerId) {
        if (!cancelled) setLoading(false);
        return;
      }
      const [l, scr, oral, silent, pic, pl] = await Promise.all([
        getRecord(STORES.learners, learnerId),
        listScreeningAssessmentsByLearner(learnerId),
        listReadingAttemptsByLearner(learnerId),
        listSilentAttemptsByLearner(learnerId),
        listPictureAttemptsByLearner(learnerId),
        listInterventionPlansByLearner(learnerId),
      ]);
      if (cancelled) return;
      const rosterMatch = LEARNERS.find((item) => item.id === learnerId);
      const fallbackLearner: Learner | null = rosterMatch
        ? {
            id: rosterMatch.id,
            name: rosterMatch.name,
            initials: rosterMatch.initials,
            grade: rosterMatch.grade,
            sectionId: rosterMatch.sectionId,
            level: rosterMatch.level ?? "FR",
            status: "Pending",
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        : null;
      setLearner(l ?? fallbackLearner);
      setScreenings(scr);
      setOralAttempts(oral);
      setSilentAttempts(silent);
      setPictureAttempts(pic);
      const sortedPlans = [...pl].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setPlans(sortedPlans);
      setSelectedPlanId((prev) => prev ?? sortedPlans[0]?.id ?? null);
      setLoading(false);
    }
    void readLocal();
    return () => {
      cancelled = true;
    };
  }, [learnerId, refreshTick]);

  const teacherContext = useMemo(
    () => ({
      ...DEFAULT_TEACHER_ACCESS,
      isAuthenticated: isTeacherAuthed() || DEFAULT_TEACHER_ACCESS.isAuthenticated,
    }),
    []
  );

  const accessCheck = useMemo(() => {
    if (!learner) return null;
    return assertTeacherCanAccessLearner(teacherContext, learner);
  }, [learner, teacherContext]);

  const summary = useMemo(() => {
    if (!learner) return null;
    return buildStudentInterventionSummary({
      learner,
      screenings,
      oralAttempts,
      silentAttempts,
      pictureAttempts,
      plans,
    });
  }, [learner, screenings, oralAttempts, silentAttempts, pictureAttempts, plans]);

  const effectiveSelectedAssessmentIds = useMemo(() => {
    if (selectedAssessmentIds !== null) return selectedAssessmentIds;
    if (!summary || summary.assessmentRefs.length === 0) return [];
    const eligibleIds = summary.assessmentRefs
      .filter((r) => r.eligibleTrigger)
      .map((r) => r.id);
    return eligibleIds.length > 0
      ? eligibleIds
      : summary.assessmentRefs.map((r) => r.id);
  }, [selectedAssessmentIds, summary]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId]
  );

  const handleToggleAssessmentRef = (id: string) => {
    setSelectedAssessmentIds((prev) => {
      const current = prev ?? effectiveSelectedAssessmentIds;
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  };

  const handleGeneratePlan = async (isFollowUp = false) => {
    if (!learner || !summary) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const chosenRefs = summary.assessmentRefs.filter((r) =>
      effectiveSelectedAssessmentIds.includes(r.id)
    );
    const effectiveRefs = chosenRefs.length > 0 ? chosenRefs : summary.assessmentRefs;

    const dupGuard = canCreateInterventionPlan({
      existingPlans: plans,
      learnerId: learner.id,
      assessmentIds: effectiveRefs.map((r) => r.id),
      isFollowUp,
    });

    if (!dupGuard.allowed) {
      setErrorMsg(dupGuard.reason ?? "Duplicate active plan exists.");
      if (dupGuard.conflictingPlanId) {
        setSelectedPlanId(dupGuard.conflictingPlanId);
      }
      return;
    }

    setGenerating(true);
    try {
      const plan = await generateInterventionPlanWithGemini({
        learner,
        teacher: teacherContext,
        assessmentRefs: effectiveRefs,
        oralAttempt: summary.latestOral,
        silentAttempt: summary.latestSilent,
        pictureAttempt: summary.latestPicture,
        teacherObservations,
        existingPlans: plans,
        isFollowUp,
        followUpFromPlanId: isFollowUp ? activePlan?.id : undefined,
      });

      await putRecord(STORES.interventionPlans, plan);
      // Push a newly created assignment immediately so the learner's active
      // dashboard can pick it up on its next sync refresh.
      void syncNow().catch(() => {});
      setRefreshTick((t) => t + 1);
      setSelectedPlanId(plan.id);
      setInfoMsg(
        plan.aiMetadata?.fallbackUsed
          ? `Intervention plan generated (curriculum-aligned fallback used: ${plan.aiMetadata.warning}). Please review and approve.`
          : "Gemini-powered intervention plan generated! Review and edit before approving."
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate intervention plan."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlanEdits = async () => {
    if (!activePlan) return;
    const now = new Date().toISOString();
    const updated: InterventionPlan = {
      ...activePlan,
      schedule: draftSchedule.trim() || activePlan.schedule,
      teacherNotes: draftNotes,
      followUpAssessmentSummary: draftFollowUpSummary.trim() || undefined,
      auditLog: [
        ...activePlan.auditLog,
        {
          id: `audit-${Date.now()}-edit`,
          timestamp: now,
          actor: teacherContext.teacherId,
          action: "plan-edited",
          summary: "Teacher updated plan schedule, notes, or follow-up summary.",
        },
      ],
      updatedAt: now,
    };
    await putRecord(STORES.interventionPlans, updated);
    setEditingPlanMeta(false);
    setRefreshTick((t) => t + 1);
    setInfoMsg("Saved changes to the intervention plan.");
  };

  const handleStatusChange = async (nextStatus: InterventionPlanStatus) => {
    if (!activePlan) return;
    const updated = updateInterventionPlanStatus(
      activePlan,
      nextStatus,
      teacherContext.teacherId
    );
    await putRecord(STORES.interventionPlans, updated);
    void syncNow().catch(() => {});
    setRefreshTick((t) => t + 1);
    setInfoMsg(`Plan status updated to '${nextStatus}'.`);
  };

  const handleDeletePlan = async () => {
    if (!activePlan) return;
    await softDelete(STORES.interventionPlans, activePlan.id);
    void syncNow().catch(() => {});
    setSelectedPlanId(null);
    setRefreshTick((t) => t + 1);
    setInfoMsg("Intervention plan deleted from IndexedDB (and synced). You can now generate a fresh plan.");
  };

  const handleDeleteAssessmentRecord = async (
    kind: "screening" | "oral" | "silent" | "picture",
    id: string
  ) => {
    const storeMap = {
      screening: STORES.screeningAssessments,
      oral: STORES.readingAttempts,
      silent: STORES.silentAttempts,
      picture: STORES.pictureAttempts,
    } as const;
    await softDelete(storeMap[kind], id);
    void syncNow().catch(() => {});
    setSelectedAssessmentIds(null);
    setRefreshTick((t) => t + 1);
    setInfoMsg(`Deleted ${kind} assessment record from IndexedDB.`);
  };

  const handleAutoGradeActivity = async (activity: InterventionPlanActivity) => {
    if (!activePlan) return;
    const responses = studentAnswersByActivity[activity.id] ?? {};
    const updated = recordActivityAutoGrade(
      activePlan,
      activity.id,
      responses,
      teacherContext.teacherId
    );
    await putRecord(STORES.interventionPlans, updated);
    setRefreshTick((t) => t + 1);
    setInfoMsg(`Auto-graded '${activity.title}'. Teacher can now review or adjust the score.`);
  };

  const handleTeacherReviewActivity = async (activity: InterventionPlanActivity) => {
    if (!activePlan) return;
    const rawScore =
      teacherScoreInput[activity.id] ??
      String(activity.result?.finalScore ?? activity.studentExercise.objectiveItems.length);
    const numericScore = Number(rawScore);
    if (Number.isNaN(numericScore)) {
      setErrorMsg("Please enter a valid numeric score for teacher review.");
      return;
    }

    const updated = applyTeacherActivityReview(activePlan, activity.id, {
      finalScore: numericScore,
      maxScore:
        activity.result?.maxScore ??
        (activity.studentExercise.objectiveItems.reduce((a, b) => a + (b.points || 1), 0) || 10),
      teacherComment: teacherCommentInput[activity.id]?.trim() || undefined,
      reviewedBy: teacherContext.teacherId,
    });
    await putRecord(STORES.interventionPlans, updated);
    setRefreshTick((t) => t + 1);
    setInfoMsg(`Saved teacher review for '${activity.title}'.`);
  };

  if (loading) {
    return (
      <div className="p-8 text-center font-sans text-sm text-gray-500">
        Loading student intervention workspace...
      </div>
    );
  }

  if (!learner) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/teacher/interventions")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-500 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Intervention Dashboard
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Student record not found.
        </div>
      </div>
    );
  }

  if (accessCheck && !accessCheck.allowed) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate("/teacher/interventions")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-sprout-500 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Intervention Dashboard
        </button>
        <div className="rounded-xl border border-coral-500/30 bg-coral-50 p-6 flex items-start gap-3 text-coral-500">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-bold text-base">Access Restricted</h2>
            <p className="font-sans text-sm mt-1">{accessCheck.reason}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Student Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate("/teacher/interventions")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-charcoal"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Intervention List
        </button>

        <button
          type="button"
          onClick={() => navigate(`/teacher/learners/${learner.id}`)}
          className="text-xs font-semibold text-sprout-500 hover:underline"
        >
          View Full Learner Profile →
        </button>
      </div>

      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-sprout-50 text-sprout-500 flex items-center justify-center font-display font-bold text-lg">
            {learner.initials}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-bold text-charcoal">
                {learner.name}
              </h1>
              <span className="rounded-md bg-paper border border-gray-200 px-2 py-0.5 text-xs font-mono text-gray-500">
                {learner.id}
              </span>
            </div>
            <p className="font-sans text-xs text-gray-500 mt-0.5">
              {summary?.sectionLabel} • Baseline grades and assessment records are preserved
              separately from intervention activities.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary?.eligible ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-coral-50 px-3 py-1 text-xs font-semibold text-coral-500 border border-coral-500/20">
              <AlertCircle className="w-3.5 h-3.5" /> Eligible for Reading Intervention
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sprout-50 px-3 py-1 text-xs font-semibold text-sprout-500 border border-sprout-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Meets Benchmark
            </span>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="rounded-xl border border-coral-500/30 bg-coral-50 px-4 py-3 text-sm font-sans text-coral-500 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {infoMsg && (
        <div className="rounded-xl border border-sprout-500/30 bg-sprout-50 px-4 py-3 text-sm font-sans text-charcoal flex items-center justify-between">
          <span>{infoMsg}</span>
          <button
            type="button"
            onClick={() => setInfoMsg(null)}
            className="text-xs font-semibold text-sprout-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step 1: Select Assessment Records & Generate Gemini Plan */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold text-charcoal flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-sprout-500" />
              1. Assessment Evidence & Gemini Plan Generator
            </h2>
            <p className="font-sans text-xs text-gray-500">
              Select the student&apos;s existing assessment records to use as the basis for the
              intervention plan. Prepopulated automatically from existing records.
            </p>
          </div>
        </div>

        {summary && summary.assessmentRefs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.assessmentRefs.map((ref) => {
              const checked = effectiveSelectedAssessmentIds.includes(ref.id);
              const displayTitle = ref.title.replace(/Salita at Larawan/g, "Supplementary Activity");
              const displayRemarks = ref.remarks.replace(/Salita at Larawan/g, "Supplementary activity");
              return (
                <label
                  key={ref.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
                    checked
                      ? "border-sprout-500 bg-sprout-50/40"
                      : "border-gray-200 bg-paper/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleAssessmentRef(ref.id)}
                    className="mt-1 accent-sprout-500"
                  />
                  <div className="text-xs font-sans space-y-0.5 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-charcoal">{displayTitle}</span>
                        {ref.eligibleTrigger && (
                          <span className="rounded bg-coral-50 px-1.5 py-0.5 text-[10px] font-semibold text-coral-500">
                            Trigger
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDeleteAssessmentRecord(ref.kind, ref.id);
                        }}
                        title="Delete this assessment record from IndexedDB"
                        className="rounded p-1 text-gray-400 hover:bg-coral-50 hover:text-coral-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-gray-600">
                      Score: <strong>{ref.score}/{ref.maxScore}</strong>{" "}
                      {ref.usesZeroToSixteenThreshold
                        ? "(0–16 Screening Scale)"
                        : `(${ref.kind.toUpperCase()} Scale)`}
                    </div>
                    <div className="text-gray-500">{displayRemarks}</div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-xs font-sans text-gray-500">
            No completed assessments recorded yet for this learner. You can still generate a
            foundational intervention plan using teacher observations below.
          </p>
        )}

        <div className="space-y-1">
          <label className="block font-sans text-xs font-semibold text-gray-600">
            Teacher Observations / Specific Reading Difficulties (Optional)
          </label>
          <textarea
            rows={2}
            value={teacherObservations}
            onChange={(e) => setTeacherObservations(e.target.value)}
            placeholder="Hal. Nahihirapan sa pagkilala ng tunog ng titik m, s, a, i, o, b (Marungko) o mabagal sa pagbasa ng payak na pangungusap..."
            className="w-full rounded-xl border border-gray-200 bg-paper px-3 py-2 text-xs font-sans text-charcoal"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs font-sans text-gray-500">
            Powered by <strong>Gemini 3.8 Flash</strong> +{" "}
            <strong>DepEd LR Portal ARAL Catalog (SY 2026–2027)</strong>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGeneratePlan(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-sprout-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generating ? "Generating with Gemini..." : "Generate Intervention Plan"}
            </button>

            {plans.length > 0 && (
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleGeneratePlan(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal hover:bg-paper disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5 text-sprout-500" />
                Create Follow-Up Plan
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Plan Switcher if multiple plans exist */}
      {plans.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Plan History:</span>
          {plans.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlanId(p.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-colors ${
                activePlan?.id === p.id
                  ? "bg-charcoal text-white border-charcoal"
                  : "bg-white text-charcoal border-gray-200 hover:bg-paper"
              }`}
            >
              Plan #{plans.length - idx} ({p.status} •{" "}
              {new Date(p.createdAt).toLocaleDateString()})
            </button>
          ))}
        </div>
      )}

      {/* Active Intervention Plan Workspace */}
      {activePlan && (
        <div className="space-y-6">
          {/* Plan Status & Overview Card */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-sprout-50 px-2.5 py-0.5 text-xs font-semibold text-sprout-500">
                    Status: {activePlan.status}
                  </span>
                  {activePlan.followUpFromPlanId && (
                    <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-500">
                      Follow-Up Plan
                    </span>
                  )}
                </div>
                <h2 className="mt-1 font-display text-lg font-bold text-charcoal">
                  Intervention Plan — Grade {activePlan.gradeLevel} ({activePlan.sectionLabel})
                </h2>
                <p className="font-sans text-xs text-gray-500">
                  Categories: {activePlan.recommendedCategories.join(", ")} • Created{" "}
                  {new Date(activePlan.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Workflow Status Stepper */}
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_STEPS.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => void handleStatusChange(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      activePlan.status === st
                        ? "bg-sprout-500 text-white"
                        : "bg-paper text-gray-600 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {st}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleDeletePlan()}
                  title="Delete this intervention plan"
                  className="inline-flex items-center gap-1 rounded-lg bg-coral-50 border border-coral-500/20 px-2.5 py-1 text-xs font-semibold text-coral-500 hover:bg-coral-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Plan
                </button>
              </div>
            </div>

            {activePlan.aiMetadata?.warning && (
              <div className="rounded-xl bg-buttercup-50 border border-buttercup-500/30 px-3.5 py-2 text-xs font-sans text-amber-900">
                Note: {activePlan.aiMetadata.warning}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="rounded-xl bg-paper p-3.5 space-y-1.5">
                <div className="font-semibold text-charcoal uppercase tracking-wider text-[11px]">
                  Identified Skill Gaps (Observable Needs)
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {activePlan.skillGaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl bg-paper p-3.5 space-y-1.5">
                <div className="font-semibold text-charcoal uppercase tracking-wider text-[11px]">
                  Grade-Appropriate Learning Objectives
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-700">
                  {activePlan.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Editable Schedule & Teacher Notes */}
            <div className="border-t border-gray-100 pt-3">
              {!editingPlanMeta ? (
                <div className="flex flex-wrap items-start justify-between gap-4 text-xs font-sans">
                  <div className="space-y-1">
                    <div>
                      <span className="font-semibold text-charcoal">Proposed Schedule:</span>{" "}
                      <span className="text-gray-700">{activePlan.schedule}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-charcoal">Teacher Notes:</span>{" "}
                      <span className="text-gray-700">
                        {activePlan.teacherNotes || "None added yet"}
                      </span>
                    </div>
                    {activePlan.followUpAssessmentSummary && (
                      <div>
                        <span className="font-semibold text-charcoal">
                          Follow-Up Assessment Results:
                        </span>{" "}
                        <span className="text-gray-700">
                          {activePlan.followUpAssessmentSummary}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSchedule(activePlan.schedule);
                      setDraftNotes(activePlan.teacherNotes);
                      setDraftFollowUpSummary(
                        activePlan.followUpAssessmentSummary ?? ""
                      );
                      setEditingPlanMeta(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-paper"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Plan Details
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs font-sans">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="font-semibold text-gray-600">Proposed Schedule</span>
                      <input
                        type="text"
                        value={draftSchedule}
                        onChange={(e) => setDraftSchedule(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-paper px-3 py-1.5"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="font-semibold text-gray-600">
                        Follow-Up Assessment Results Summary
                      </span>
                      <input
                        type="text"
                        value={draftFollowUpSummary}
                        onChange={(e) => setDraftFollowUpSummary(e.target.value)}
                        placeholder="Hal. Post-intervention screening: 18/20 (Grade Ready)"
                        className="w-full rounded-lg border border-gray-200 bg-paper px-3 py-1.5"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1">
                    <span className="font-semibold text-gray-600">Teacher Progress Notes</span>
                    <textarea
                      rows={2}
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-paper px-3 py-1.5"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPlanMeta(false)}
                      className="rounded-lg border border-gray-200 px-3 py-1 font-semibold text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSavePlanEdits()}
                      className="rounded-lg bg-sprout-500 px-3 py-1 font-semibold text-white"
                    >
                      Save Plan Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Generated Activities & Printable/Interactive Learning Materials */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-charcoal">
              2. Recommended Intervention Activities & Generated Learning Materials (
              {activePlan.activities.length})
            </h3>

            {activePlan.activities.map((act, index) => {
              const currentAnswers = studentAnswersByActivity[act.id] ?? {};
              return (
                <article
                  key={act.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4"
                >
                  {/* Activity Header & Attribution */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-sprout-50 px-2.5 py-0.5 text-xs font-bold text-sprout-500">
                          Activity {index + 1}: {act.category}
                        </span>
                        <span className="text-xs font-sans text-gray-500">
                          Est. {act.estimatedMinutes} mins
                        </span>
                        {act.approvedByTeacher && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sprout-50 px-2 py-0.5 text-[11px] font-semibold text-sprout-500">
                            <CheckCircle2 className="w-3 h-3" /> Teacher Approved
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-base font-bold text-charcoal">
                        {act.title}
                      </h4>
                      <p className="font-sans text-xs text-gray-600">
                        <strong>Reason:</strong> {act.reasonForRecommendation}
                      </p>
                    </div>

                    {/* Honest DepEd LR Portal vs AI Attribution Box */}
                    <div className="rounded-xl border border-gray-200 bg-paper p-3 text-xs font-sans max-w-sm space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-charcoal">
                        <BookOpen className="w-3.5 h-3.5 text-sprout-500 shrink-0" />
                        <span>{act.resourceAttribution.label}</span>
                      </div>
                      {act.resourceAttribution.selectionReason && (
                        <p className="text-[11px] text-gray-500">
                          {act.resourceAttribution.selectionReason}
                        </p>
                      )}
                      {act.resourceAttribution.sourceUrl && (
                        <a
                          href={act.resourceAttribution.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sprout-500 hover:underline"
                        >
                          Open DepEd LR Portal Resource <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Teacher Guide & Required Materials */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    <div className="space-y-1.5">
                      <div className="font-semibold text-charcoal">
                        Step-by-Step Teacher Instructions:
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-gray-700">
                        {act.teacherInstructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-1.5">
                      <div className="font-semibold text-charcoal">Required Materials:</div>
                      <ul className="list-disc list-inside space-y-1 text-gray-700">
                        {act.requiredMaterials.map((mat, i) => (
                          <li key={i}>{mat}</li>
                        ))}
                      </ul>
                      <div className="pt-1 text-gray-600">
                        <strong>Success Criteria:</strong> {act.successCriteria}
                      </div>
                    </div>
                  </div>

                  {/* Generated Student-Facing Worksheet / Material */}
                  <div className="rounded-xl border border-sprout-500/20 bg-paper p-4 space-y-3 font-sans">
                    <div className="text-xs font-bold uppercase tracking-wider text-sprout-500">
                      Generated Student Learning Material & Practice Exercise
                    </div>
                    <p className="text-xs font-medium text-charcoal">
                      Panuto: {act.studentExercise.instructions}
                    </p>

                    {act.studentExercise.marungkoSequenceLetters && (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-gray-600">
                          Target Marungko Sequence Letters:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {act.studentExercise.marungkoSequenceLetters.map((letter) => (
                            <span
                              key={letter}
                              className="rounded-lg bg-white border border-gray-200 px-3 py-1 font-display font-bold text-sm text-charcoal"
                            >
                              {letter.toUpperCase()} / {letter}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {act.studentExercise.syllables &&
                      act.studentExercise.syllables.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-600">
                            Pagsasanay sa Pantig (Syllable Blending):
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {act.studentExercise.syllables.map((syl, i) => (
                              <span
                                key={i}
                                className="rounded-lg bg-buttercup-50 px-2.5 py-1 text-xs font-bold text-charcoal"
                              >
                                {syl}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {act.studentExercise.wordList &&
                      act.studentExercise.wordList.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-600">
                            Mga Salitang Babasahin (Word List):
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {act.studentExercise.wordList.map((word, i) => (
                              <span
                                key={i}
                                className="rounded-lg bg-white border border-gray-200 px-3 py-1 text-sm font-reading font-semibold text-charcoal"
                              >
                                {word}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {act.studentExercise.passageTitle && (
                      <div className="rounded-xl bg-white border border-gray-200 p-3.5 space-y-2">
                        <h5 className="font-display font-bold text-sm text-charcoal">
                          {act.studentExercise.passageTitle}
                        </h5>
                        {act.studentExercise.passageParagraphs?.map((para, i) => (
                          <p key={i} className="font-reading text-sm text-gray-800 leading-relaxed">
                            {para}
                          </p>
                        ))}
                        {act.studentExercise.vocabularyItems &&
                          act.studentExercise.vocabularyItems.length > 0 && (
                            <div className="pt-2 border-t border-gray-100 text-xs space-y-1">
                              <div className="font-semibold text-gray-600">Talasalitaan:</div>
                              {act.studentExercise.vocabularyItems.map((v, i) => (
                                <div key={i}>
                                  <strong>{v.word}</strong> — {v.meaning}
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    )}

                    {/* Objective Questions with Interactive Auto-Grading */}
                    <div className="space-y-2.5 pt-2">
                      <div className="text-xs font-semibold text-charcoal">
                        Pagsasanay (Objective Questions — Supports Automatic Grading):
                      </div>
                      {act.studentExercise.objectiveItems.map((item, qIdx) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-white border border-gray-200 p-3 space-y-2 text-xs"
                        >
                          <div className="font-semibold text-charcoal">
                            {qIdx + 1}. {item.prompt}
                          </div>
                          {item.choices && item.choices.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.choices.map((choice) => {
                                const selected = currentAnswers[item.id] === choice;
                                return (
                                  <button
                                    key={choice}
                                    type="button"
                                    onClick={() =>
                                      setStudentAnswersByActivity((prev) => ({
                                        ...prev,
                                        [act.id]: {
                                          ...(prev[act.id] ?? {}),
                                          [item.id]: choice,
                                        },
                                      }))
                                    }
                                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                                      selected
                                        ? "border-sprout-500 bg-sprout-500 text-white"
                                        : "border-gray-200 bg-paper text-charcoal hover:bg-gray-100"
                                    }`}
                                  >
                                    {choice}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder="Isulat ang sagot..."
                              value={currentAnswers[item.id] ?? ""}
                              onChange={(e) =>
                                setStudentAnswersByActivity((prev) => ({
                                  ...prev,
                                  [act.id]: {
                                    ...(prev[act.id] ?? {}),
                                    [item.id]: e.target.value,
                                  },
                                }))
                              }
                              className="rounded-lg border border-gray-200 bg-paper px-2.5 py-1 text-xs"
                            />
                          )}
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="text-[11px] text-gray-500">
                          <strong>Answer Key:</strong> {act.answerKeySummary} |{" "}
                          <strong>Rubric:</strong> {act.assessmentRubric}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleAutoGradeActivity(act)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                        >
                          <Play className="w-3.5 h-3.5" /> Auto-Grade Objective Items
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Grading Result & Teacher Review / Override Controls */}
                  <div className="rounded-xl border border-gray-200 bg-white p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <div className="font-semibold text-charcoal flex items-center gap-2">
                        <span>Activity Grading & Teacher Review</span>
                        {act.result && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              act.result.gradingMode === "teacher-corrected"
                                ? "bg-buttercup-50 text-amber-900"
                                : act.result.gradingMode === "teacher-reviewed"
                                ? "bg-sprout-50 text-sprout-500"
                                : "bg-sky-50 text-sky-500"
                            }`}
                          >
                            {act.result.gradingMode}
                          </span>
                        )}
                      </div>
                      {act.result ? (
                        <div className="text-gray-600">
                          Final Score: <strong>{act.result.finalScore}/{act.result.maxScore}</strong>
                          {act.result.autoCalculatedScore !== undefined && (
                            <span>
                              {" "}
                              (Auto-calculated: {act.result.autoCalculatedScore}/
                              {act.result.maxScore})
                            </span>
                          )}{" "}
                          — {act.result.remarks}
                          {act.result.teacherComment && (
                            <div className="text-gray-500 italic">
                              Teacher Comment: &ldquo;{act.result.teacherComment}&rdquo;
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-500">
                          Not yet graded. Run Auto-Grade above or enter teacher-reviewed score
                          directly.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={
                          act.result?.maxScore ??
                          (act.studentExercise.objectiveItems.length || 10)
                        }
                        placeholder="Score"
                        value={
                          teacherScoreInput[act.id] ??
                          (act.result ? String(act.result.finalScore) : "")
                        }
                        onChange={(e) =>
                          setTeacherScoreInput((prev) => ({
                            ...prev,
                            [act.id]: e.target.value,
                          }))
                        }
                        className="w-16 rounded-lg border border-gray-200 bg-paper px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Teacher comment / observation..."
                        value={
                          teacherCommentInput[act.id] ??
                          act.result?.teacherComment ??
                          ""
                        }
                        onChange={(e) =>
                          setTeacherCommentInput((prev) => ({
                            ...prev,
                            [act.id]: e.target.value,
                          }))
                        }
                        className="w-48 rounded-lg border border-gray-200 bg-paper px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleTeacherReviewActivity(act)}
                        className="rounded-lg bg-sprout-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                      >
                        Approve / Adjust Score
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Audit Log Section */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="font-display text-sm font-bold text-charcoal flex items-center gap-1.5">
              <History className="w-4 h-4 text-gray-500" />
              Intervention Audit Trail & History
            </h3>
            <div className="space-y-1.5 text-xs font-sans text-gray-600">
              {activePlan.auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-paper px-3 py-2"
                >
                  <div>
                    <span className="font-semibold text-charcoal">[{entry.action}]</span>{" "}
                    {entry.summary}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {entry.actor} • {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
