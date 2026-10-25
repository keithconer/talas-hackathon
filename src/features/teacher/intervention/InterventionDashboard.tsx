import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FilePlus2,
  Filter,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  listRecords,
  putRecord,
  softDelete,
} from "../../../data/repository";
import { syncNow } from "../../../data/syncController";
import {
  STORES,
  type InterventionPlan,
  type Learner,
  type PictureAttempt,
  type ReadingAttempt,
  type ScreeningAssessment,
  type SilentAttempt,
} from "../../../data/types";
import { isTeacherAuthed } from "../../auth/teacherSession";
import { LEARNERS } from "../dashboard/sectionData";
import {
  buildStudentInterventionSummary,
  DEFAULT_TEACHER_ACCESS,
  evaluateAssessmentEligibility,
  INTERVENTION_SECTIONS,
  type StudentInterventionSummary,
} from "./interventionEngine";
import { DEPED_ARAL_LR_PORTAL_URL, DEPED_LR_CATALOG } from "./depedCatalog";
import Pagination from "../shared/Pagination";

const PAGE_SIZE = 8;

export default function InterventionDashboard() {
  const navigate = useNavigate();

  const [learners, setLearners] = useState<Learner[]>([]);
  const [screenings, setScreenings] = useState<ScreeningAssessment[]>([]);
  const [oralAttempts, setOralAttempts] = useState<ReadingAttempt[]>([]);
  const [silentAttempts, setSilentAttempts] = useState<SilentAttempt[]>([]);
  const [pictureAttempts, setPictureAttempts] = useState<PictureAttempt[]>([]);
  const [plans, setPlans] = useState<InterventionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [assessmentFilter, setAssessmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recordsPage, setRecordsPage] = useState(1);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // Record Screening Modal state (20-point scale where 0–16 = eligible)
  const [screeningModalLearnerId, setScreeningModalLearnerId] = useState<string>("");
  const [screeningName, setScreeningName] = useState<string>(
    "ARAL Reading Intervention Screening (KS1)"
  );
  const [screeningScore, setScreeningScore] = useState<string>("12");
  const [screeningNotes, setScreeningNotes] = useState<string>("");
  const [savingScreening, setSavingScreening] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function readLocal() {
      const [l, scr, oral, silent, pic, pl] = await Promise.all([
        listRecords(STORES.learners),
        listRecords(STORES.screeningAssessments),
        listRecords(STORES.readingAttempts),
        listRecords(STORES.silentAttempts),
        listRecords(STORES.pictureAttempts),
        listRecords(STORES.interventionPlans),
      ]);
      if (cancelled) return;
      const byId = new Map<string, Learner>();
      for (const item of LEARNERS) {
        byId.set(item.id, {
          id: item.id,
          name: item.name,
          initials: item.initials,
          grade: item.grade,
          sectionId: item.sectionId,
          level: item.level ?? "FR",
          status: "Pending",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        });
      }
      for (const dbLearner of l) {
        byId.set(dbLearner.id, dbLearner);
      }
      setLearners(Array.from(byId.values()));
      setScreenings(scr);
      setOralAttempts(oral);
      setSilentAttempts(silent);
      setPictureAttempts(pic);
      setPlans(pl);
      setLoading(false);
    }
    void readLocal();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const teacherContext = useMemo(
    () => ({
      ...DEFAULT_TEACHER_ACCESS,
      isAuthenticated: isTeacherAuthed() || DEFAULT_TEACHER_ACCESS.isAuthenticated,
    }),
    []
  );

  // Build summaries strictly for Grades 1–3 students under authorized sections
  const studentSummaries = useMemo(() => {
    const list: StudentInterventionSummary[] = [];
    for (const learner of learners) {
      if (
        learner.sectionId &&
        !(teacherContext.authorizedSectionIds as readonly string[]).includes(learner.sectionId)
      ) {
        continue;
      }
      const summary = buildStudentInterventionSummary({
        learner,
        screenings: screenings.filter((s) => s.learnerId === learner.id),
        oralAttempts: oralAttempts.filter((a) => a.learnerId === learner.id),
        silentAttempts: silentAttempts.filter((a) => a.learnerId === learner.id),
        pictureAttempts: pictureAttempts.filter((a) => a.learnerId === learner.id),
        plans: plans.filter((p) => p.learnerId === learner.id),
      });
      if (summary) {
        list.push(summary);
      }
    }
    return list.sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return a.learner.name.localeCompare(b.learner.name);
    });
  }, [learners, screenings, oralAttempts, silentAttempts, pictureAttempts, plans, teacherContext]);

  const filteredSummaries = useMemo(() => {
    return studentSummaries.filter((item) => {
      if (gradeFilter !== "all" && String(item.gradeLevel) !== gradeFilter) {
        return false;
      }
      if (sectionFilter !== "all" && item.learner.sectionId !== sectionFilter) {
        return false;
      }
      if (assessmentFilter !== "all") {
        const hasKind = item.assessmentRefs.some((r) => r.kind === assessmentFilter);
        if (!hasKind) return false;
      }
      if (statusFilter !== "all" && item.interventionStatus !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [studentSummaries, gradeFilter, sectionFilter, assessmentFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredSummaries.length / PAGE_SIZE));
  const currentPage = Math.min(recordsPage, pageCount);
  const visibleSummaries = filteredSummaries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => setRecordsPage(1), [gradeFilter, sectionFilter, assessmentFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = studentSummaries.length;
    const eligibleCount = studentSummaries.filter((s) => s.eligible).length;
    const activePlanCount = studentSummaries.filter((s) => s.activePlan !== null).length;
    const completedCount = plans.filter((p) => p.status === "Completed").length;
    return { total, eligibleCount, activePlanCount, completedCount };
  }, [studentSummaries, plans]);

  const handleRecordScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screeningModalLearnerId) return;
    const numericScore = Number(screeningScore);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 20) {
      setBannerMessage("Please enter a valid screening score between 0 and 20.");
      return;
    }

    const targetSummary = studentSummaries.find(
      (s) => s.learner.id === screeningModalLearnerId
    );
    if (!targetSummary) return;

    setSavingScreening(true);
    try {
      const now = new Date().toISOString();
      const evalResult = evaluateAssessmentEligibility({
        id: "preview",
        kind: "screening",
        title: screeningName,
        date: now,
        score: numericScore,
        maxScore: 20,
        usesZeroToSixteenThreshold: true,
      });

      const newScreening: ScreeningAssessment = {
        id: `scr-${targetSummary.learner.id}-${Date.now()}`,
        learnerId: targetSummary.learner.id,
        sectionId: targetSummary.learner.sectionId || "sampaguita",
        grade: targetSummary.learner.grade,
        assessmentName: screeningName.trim() || "ARAL Reading Intervention Screening (KS1)",
        score: numericScore,
        maxScore: 20,
        usesZeroToSixteenThreshold: true,
        oralReadingNotes: screeningNotes.trim() || undefined,
        remarks: evalResult.remarks,
        assessedBy: teacherContext.teacherId,
        createdAt: now,
        updatedAt: now,
      };

      await putRecord(STORES.screeningAssessments, newScreening);
      setRefreshTick((t) => t + 1);
      setScreeningModalLearnerId("");
      setScreeningNotes("");
      setBannerMessage(
        `Saved screening score (${numericScore}/20) for ${targetSummary.learner.name}. ${
          evalResult.eligible
            ? "Student is eligible for Reading Intervention (0–16 threshold)."
            : "Score is above the 0–16 intervention threshold."
        }`
      );
    } finally {
      setSavingScreening(false);
    }
  };

  const renderStatusBadge = (status: StudentInterventionSummary["interventionStatus"]) => {
    switch (status) {
      case "Needs Intervention":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-coral-50 px-2.5 py-1 text-xs font-semibold text-coral-500 border border-coral-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Needs Intervention
          </span>
        );
      case "Draft":
      case "Pending Review":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-buttercup-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-buttercup-500/30">
            {status}
          </span>
        );
      case "Approved":
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-500 border border-sky-500/20">
            {status}
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sprout-50 px-2.5 py-1 text-xs font-semibold text-sprout-500 border border-sprout-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        );
      case "Ungraded":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            Ungraded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sprout-50 px-2.5 py-1 text-xs font-medium text-sprout-500">
            Benchmark Met
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-sprout-50 px-3 py-1 text-xs font-semibold text-sprout-500">
            <Sparkles className="w-3.5 h-3.5" /> Grades 1–3 Reading Intervention System
          </div>
          <h1 className="font-display text-2xl font-bold text-charcoal tracking-tight">
            Student Reading Intervention
          </h1>
          <p className="font-sans text-sm text-gray-500 max-w-2xl">
            Identify Grades 1–3 learners who need targeted reading support (0–16 Screening scale or
            CRLA Refresher), generate Gemini-powered Filipino intervention activities, and align with
            DepEd ARAL Supplementary Materials (SY 2026–2027).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCatalogModal((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-charcoal shadow-sm hover:bg-paper transition-colors"
          >
            <BookOpen className="w-4 h-4 text-sprout-500" />
            {showCatalogModal ? "Hide DepEd LR Catalog" : "DepEd ARAL LR Catalog"}
          </button>
          <button
            type="button"
            onClick={() =>
              setScreeningModalLearnerId(studentSummaries[0]?.learner.id ?? "")
            }
            className="inline-flex items-center gap-2 rounded-xl bg-sprout-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-opacity"
          >
            <ClipboardCheck className="w-4 h-4" />
            Record Screening Score (0–20)
          </button>
        </div>
      </header>

      {bannerMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sprout-500/30 bg-sprout-50 px-4 py-3 text-sm font-sans text-charcoal">
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-xs font-semibold text-sprout-500 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span>Grades 1–3 Learners</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-charcoal">{stats.total}</p>
          <p className="mt-0.5 font-sans text-xs text-gray-500">
            Authorized sections (Sampaguita, Rosal, Mabini)
          </p>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-coral-500 uppercase tracking-wider">
            <span>Eligible for Intervention</span>
            <AlertCircle className="w-4 h-4 text-coral-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-charcoal">
            {stats.eligibleCount}
          </p>
          <p className="mt-0.5 font-sans text-xs text-gray-500">
            Score 0–16 (out of 20) or CRLA Refresher
          </p>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-500 uppercase tracking-wider">
            <span>Active Plans</span>
            <Sparkles className="w-4 h-4 text-sky-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-charcoal">
            {stats.activePlanCount}
          </p>
          <p className="mt-0.5 font-sans text-xs text-gray-500">
            Draft, Pending Review, Approved, or In Progress
          </p>
        </div>

        <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-sprout-500 uppercase tracking-wider">
            <span>Completed Plans</span>
            <CheckCircle2 className="w-4 h-4 text-sprout-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-charcoal">
            {stats.completedCount}
          </p>
          <p className="mt-0.5 font-sans text-xs text-gray-500">
            Reviewed & archived with teacher remarks
          </p>
        </div>
      </div>

      {/* Optional DepEd LR Portal Catalog Panel */}
      {showCatalogModal && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-charcoal">
                DepEd LR Portal — ARAL Supplementary Materials Catalog (SY 2026–2027)
              </h2>
              <p className="font-sans text-xs text-gray-500">
                Curated Key Stage 1 (Grades 1–3) Filipino literacy materials used to ground Gemini
                intervention recommendations.
              </p>
            </div>
            <a
              href={DEPED_ARAL_LR_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sprout-50 px-3 py-1.5 text-xs font-semibold text-sprout-500 hover:underline"
            >
              Open Official DepEd LR Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEPED_LR_CATALOG.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 bg-paper p-3.5 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-sprout-500 border border-gray-200">
                    Grade {item.gradeLevel} • {item.category}
                  </span>
                  <span className="text-xs font-sans text-gray-500 capitalize">
                    {item.materialType}
                  </span>
                </div>
                <p className="font-sans text-sm font-semibold text-charcoal">{item.title}</p>
                <p className="font-sans text-xs text-gray-600">{item.literacySkill}</p>
                <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                  <span>Level: {item.applicableReadingLevel}</span>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-sprout-500 hover:underline"
                  >
                    Portal Link <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Record Screening Modal / Drawer */}
      {screeningModalLearnerId && (
        <form
          onSubmit={handleRecordScreening}
          className="rounded-2xl border border-sprout-500/30 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-charcoal">
                Record Reading Intervention Screening Score (0–20 Scale)
              </h2>
              <p className="font-sans text-xs text-gray-500">
                Scores from <strong>0 through 16 (inclusive)</strong> trigger intervention
                eligibility. Scores 17–20 indicate the learner meets the screening benchmark.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScreeningModalLearnerId("")}
              className="text-xs font-semibold text-gray-500 hover:text-charcoal"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block space-y-1">
              <span className="font-sans text-xs font-semibold text-gray-600">
                Student (Grades 1–3)
              </span>
              <select
                value={screeningModalLearnerId}
                onChange={(e) => setScreeningModalLearnerId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-paper px-3 py-2 text-sm font-sans text-charcoal"
              >
                {studentSummaries.map((s) => (
                  <option key={s.learner.id} value={s.learner.id}>
                    {s.learner.name} ({s.learner.grade} — {s.learner.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="font-sans text-xs font-semibold text-gray-600">
                Assessment Name
              </span>
              <input
                type="text"
                value={screeningName}
                onChange={(e) => setScreeningName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-paper px-3 py-2 text-sm font-sans text-charcoal"
                required
              />
            </label>

            <label className="block space-y-1">
              <span className="font-sans text-xs font-semibold text-gray-600">
                Score (0–20, 0–16 = Eligible)
              </span>
              <input
                type="number"
                min={0}
                max={20}
                value={screeningScore}
                onChange={(e) => setScreeningScore(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-paper px-3 py-2 text-sm font-sans text-charcoal"
                required
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="font-sans text-xs font-semibold text-gray-600">
              Teacher Observation / Oral Reading Notes (Optional)
            </span>
            <input
              type="text"
              placeholder="Hal. Nahihirapan sa pagbasa ng pantig na may kambal-katinig o Marungko letters..."
              value={screeningNotes}
              onChange={(e) => setScreeningNotes(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-paper px-3 py-2 text-sm font-sans text-charcoal"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setScreeningModalLearnerId("")}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={savingScreening}
              className="rounded-xl bg-sprout-500 px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {savingScreening ? "Saving..." : "Save Screening Record"}
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
          <Filter className="w-3.5 h-3.5" /> Filter Students:
        </div>

        <select
          aria-label="Filter by Grade"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-paper px-3 py-1.5 text-xs font-sans text-charcoal"
        >
          <option value="all">All Grades (Grades 1–3)</option>
          <option value="1">Grade 1</option>
          <option value="2">Grade 2</option>
          <option value="3">Grade 3</option>
        </select>

        <select
          aria-label="Filter by Section"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-paper px-3 py-1.5 text-xs font-sans text-charcoal"
        >
          <option value="all">All Sections</option>
          {INTERVENTION_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.grade})
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by Assessment Type"
          value={assessmentFilter}
          onChange={(e) => setAssessmentFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-paper px-3 py-1.5 text-xs font-sans text-charcoal"
        >
          <option value="all">All Assessment Types</option>
          <option value="screening">Screening (0–16 / 20 Scale)</option>
          <option value="oral">Oral Reading (CRLA)</option>
          <option value="silent">Silent Reading</option>
        </select>

        <select
          aria-label="Filter by Intervention Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-paper px-3 py-1.5 text-xs font-sans text-charcoal"
        >
          <option value="all">All Statuses</option>
          <option value="Needs Intervention">Needs Intervention</option>
          <option value="Draft">Draft</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Approved">Approved</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="No Intervention Needed">Benchmark Met</option>
          <option value="Ungraded">Ungraded</option>
        </select>
      </div>

      {/* Student Identification Table */}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center font-sans text-sm text-gray-500">
          Loading student assessment and intervention records...
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center space-y-2">
          <p className="font-sans text-sm font-semibold text-charcoal">
            No Grades 1–3 students match the selected filters.
          </p>
          <p className="font-sans text-xs text-gray-500">
            Try resetting the filters or recording a new Reading Intervention Screening score.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-paper text-[10px] font-sans font-semibold uppercase tracking-wide text-gray-500">
                <th className="py-2.5 px-3">Student & ID</th>
                <th className="py-2.5 px-3">Grade & Section</th>
                <th className="py-2.5 px-3">Screening (0–16 Threshold)</th>
                <th className="py-2.5 px-3">Oral Reading (CRLA)</th>
                <th className="py-2.5 px-3">Silent Reading</th>
                <th className="py-2.5 px-3">Remarks & Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-sans">
              {visibleSummaries.map((item) => {
                const scr = item.latestScreening;
                const oral = item.latestOral;
                const silent = item.latestSilent;

                return (
                  <tr
                    key={item.learner.id}
                    className="hover:bg-paper/60 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-md bg-gray-100 text-charcoal flex items-center justify-center font-semibold text-xs shrink-0">
                          {item.learner.initials}
                        </span>
                        <div>
                          <div className="font-semibold text-charcoal">
                            {item.learner.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            ID: {item.learner.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="font-medium text-charcoal">
                        Grade {item.gradeLevel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.sectionLabel}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      {scr && scr.score !== null ? (
                        <div>
                          <span
                            className={`font-semibold ${
                              scr.score <= 16 ? "text-coral-500" : "text-sprout-500"
                            }`}
                          >
                            {scr.score} / {scr.maxScore}
                          </span>
                          <div className="text-xs text-gray-500 truncate max-w-[180px]">
                            {scr.assessmentName}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {new Date(scr.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setScreeningModalLearnerId(item.learner.id)}
                          className="text-xs font-semibold text-sprout-500 hover:underline"
                        >
                          + Record (0–20)
                        </button>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      {oral ? (
                        <div>
                          <span className="font-semibold text-charcoal">
                            {Math.round(oral.accuracy)}%
                          </span>{" "}
                          {oral.durationSec && oral.durationSec > 0 ? (
                            <span className="text-xs text-gray-500">
                              ({Math.round((oral.correctWords / oral.durationSec) * 60)} WPM)
                            </span>
                          ) : null}
                          <div className="text-xs text-gray-500 truncate max-w-[160px]">
                            {oral.passageId || "Oral Passage"}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {new Date(oral.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not yet assessed</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="space-y-1 text-xs">
                        {silent ? (
                          <div>
                            <span className="font-medium text-charcoal">Silent:</span>{" "}
                            {silent.correctAnswers}/{silent.totalQuestions}
                          </div>
                        ) : (
                          <div className="text-gray-400">Silent: —</div>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        {renderStatusBadge(item.interventionStatus)}
                        <p className="text-xs text-gray-500 line-clamp-2 max-w-[240px]">
                          {item.eligibilityReason.replace(/Salita at Larawan/g, "Supplementary activity")}
                        </p>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/teacher/interventions/${item.learner.id}`)
                          }
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                            item.activePlan
                              ? "bg-sky-50 text-sky-500 border border-sky-500/20 hover:bg-sky-500 hover:text-white"
                              : item.eligible
                              ? "bg-sprout-500 text-white hover:opacity-95"
                              : "bg-paper text-charcoal border border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          <FilePlus2 className="w-3.5 h-3.5" />
                          {item.activePlan
                            ? `Manage Plan (${item.activePlan.status})`
                            : item.eligible
                            ? "Create Intervention Plan"
                            : "View / Plan"}
                        </button>
                        {item.activePlan && (
                          <button
                            type="button"
                            onClick={async () => {
                              await softDelete(
                                STORES.interventionPlans,
                                item.activePlan!.id
                              );
                              void syncNow().catch(() => {});
                              setRefreshTick((t) => t + 1);
                              setBannerMessage(
                                `Deleted active intervention plan for ${item.learner.name}.`
                              );
                            }}
                            title="Delete active intervention plan"
                            className="inline-flex items-center justify-center rounded-xl border border-coral-500/20 bg-coral-50 p-1.5 text-coral-500 hover:bg-coral-500 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <Pagination total={filteredSummaries.length} page={currentPage} pageSize={PAGE_SIZE} onPageChange={setRecordsPage} />
        </div>
      )}
    </div>
  );
}
