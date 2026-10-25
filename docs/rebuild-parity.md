# TALAS rebuild parity and verification

## Source and scope

Restored the 189 authored paths listed in Appendix A from `TALAS_REBUILD_REFERENCE.zip` into this project root. The route tree and module boundaries match the archive. The active application is selected by `src/app/router.tsx`; similarly named modules under `features/learner`, `screens/learner`, and teacher folders are retained as supplied.

The following zero-byte files are current retained placeholders/support files in the reference archive. They are not imported by the active route tree and remain empty:

```text
src/features/learner/assessment/OralAssessment.tsx
src/features/learner/assessment/SilentAssessment.tsx
src/features/learner/home/LearnerHome.tsx
src/features/learner/practice/KeepPracticing.tsx
src/features/learner/practice/PracticeActivity.tsx
src/features/learner/progress/Leaderboard.tsx
src/features/teacher/activity/ActivityReview.tsx
src/features/teacher/assessment/AssessmentEntry.tsx
src/features/teacher/assessment/OralReview.tsx
src/features/teacher/assessment/SilentReview.tsx
src/features/teacher/recommendation/RecommendationView.tsx
src/layouts/MainLayout.tsx
src/layouts/TeacherLayout.tsx
```

## Parity matrix

| Reference feature/page | Reference file(s) | Rebuilt file(s) | Retained behavior | Verification result | Limitation |
|---|---|---|---|---|---|
| `/` role selector | `src/features/auth/RoleSelector.tsx`, `RoleSelector.css` | Same paths | Teacher and student cards, exact copy, decoration URLs, mascot fallback, responsive CSS | Production build passed; all 35 asset hashes match Appendix F | No browser screenshot comparison at the specified viewport sizes |
| `/learner`, `/learner/home` code gate and dashboard | `src/features/learner/LearnerApp.tsx`, `src/features/auth/LearnerAuth.tsx`, `src/screens/learner/LearnerDashboard.tsx`, `src/features/teacher/dashboard/sectionData.ts` | Same paths | Learner-code lookup, active status, dashboard entry points, internal screen switching, exit reset | Build passed; picture-practice and data tests passed | Learner code variants, active/exit flow, and every dashboard action were not manually exercised |
| Oral assessment and result | `src/screens/learner/OralAssessment.tsx`, `OralCompletion.tsx`, `src/reading/{speech,scorer,crla,vosk}.ts`, `src/data/recordings.ts` | Same paths | Speech/manual capture, sequence-alignment scoring, per-word timing, CRLA result, local save, best-score adaptive selection, optional S3 audio | Build passed; relevant data tests passed | Microphone/model permissions, scoring boundaries, audio playback, and live S3 were not exercised |
| Silent assessment and formal completion | `src/screens/learner/SilentAssessment.tsx`, `FormalAssessmentCompletion.tsx`, `src/features/learner/LearnerApp.tsx` | Same paths | Separate silent attempt, locked answers, timing, and completion exit flow | Build passed; data tests passed | Four-answer interaction and manual timing checks were not run in a browser |
| Continued practice and completion | `src/screens/learner/practice/PracticeActivity.tsx`, `PracticeCompletion.tsx`, `src/data/practiceData.ts`, `src/data/contentBank.ts` | Same paths | Practice content, 3-high/2-low adaptation, 60–79 reset behavior, history cap, independent oral score basis | Build passed; test suite passed | Full sequence and score boundary walkthrough was not manually exercised |
| Salita at Larawan | `src/screens/learner/practice/PicturePractice.tsx`, `PicturePractice.css`, `PicturePractice.test.tsx`, `src/data/practiceData.ts` | Same paths | Separate picture attempts and teacher results, learner-scoped star key, one star per question, supplied word audio | Picture tests passed; all supplied audio hashes match | Device audio playback and cross-session browser behavior were not manually exercised |
| Learner profile | `src/screens/learner/LearnerProfile.tsx` | Same path | Current learner profile and its session-local progress/badges | Build passed | Profile interaction states were not manually exercised |
| Learner intervention workspace | `src/screens/learner/LearnerInterventionScreen.tsx`, `src/features/teacher/intervention/interventionEngine.ts` | Same paths | Assigned plan alongside regular work, exercises, grading/result record, plan status updates | Intervention suite passed (included in 35 tests) | Cross-device sync and full learner/teacher round trip were not exercised |
| Teacher PIN gate and shell | `src/features/auth/TeacherGate.tsx`, `TeacherAuth.tsx`, `teacherSession.ts`, `src/features/shared/components/AppLayout.tsx` | Same paths | Demo PIN `1234`, PIN input handling, session key `talas.teacher.authed`, horizontal top navigation, confirmation/logout actions | Build passed | Invalid/valid PIN, refresh, cancel, and logout were not manually exercised |
| `/teacher` dashboard | `src/features/teacher/dashboard/TeacherDashboard.tsx`, `DashboardHeader.tsx`, `QuickStats.tsx`, `ClassDistribution.tsx`, `LearnerListTable.tsx`, `RecentActivity.tsx`, `PendingActions.tsx`, `SectionSelector.tsx`, dashboard hooks | Same paths | Roster stats, section filters, distribution, recent activity and learner navigation | Build passed | Live UI data states and responsive screenshots were not manually compared |
| `/teacher/learners` directory | `src/features/teacher/learners/LearnersList.tsx`, dashboard data helpers | Same paths | Section-filtered learner directory and pagination | Build passed | Pagination/filter interactions were not manually exercised |
| Learner profile Overview and Practice Progress tabs | `src/layouts/LearnerLayout.tsx`, `src/features/teacher/profile/{Overview,Activities}.tsx`, hooks in the same folder | Same paths | Two current tabs, separate oral/silent/picture evidence, CRLA derived from best oral score | Build and data tests passed | Learner edge cases, media seek, and review-state behavior were not manually exercised |
| Profile compatibility URLs | `src/app/router.tsx` | Same path | `formal-assessment`, `recommendations`, and `development-profile` redirect to Overview with replace | Route declarations inspected; build passed | Browser navigation/history behavior was not manually exercised |
| `/teacher/interventions` and learner workspace | `src/features/teacher/intervention/InterventionDashboard.tsx`, `StudentInterventionView.tsx`, `interventionEngine.ts`, `depedCatalog.ts` | Same paths | Eligibility/evidence, grade and category targeting, plan creation/edit/approval, grading, audit, follow-up, attribution | Intervention tests passed | Gemini credentials and end-to-end plan lifecycle were not exercised against live services |
| `/teacher/assessments` and `/teacher/assessments/new/:learnerId` | `src/features/teacher/assessment/AssessmentsList.tsx`, `AssignAssessment.tsx` | Same paths | Existing empty assessments state and current assignment-form placeholder | Build passed; current route tree inspected | Assignment creation remains a placeholder per reference |
| `/teacher/activities` and `:activityId/review` | `src/features/teacher/activity/ActivitiesList.tsx`, `ReviewAssessment.tsx` | Same paths | Separate oral and picture logs; oral review and recording/word seek UI | Build passed | Real recording URL, expiry refresh, and media seek were not exercised |
| `/teacher/reports` | `src/features/teacher/reports/Reports.tsx` | Same path | Existing empty state | Build passed | Report generation remains absent per reference |
| No top-level `/teacher/recommendations` route | `src/app/router.tsx`; retained files under `src/features/teacher/recommendation/` | Same paths | Legacy/support recommendation modules remain, no new route is exposed | Route tree inspected; build passed | None beyond source behavior |
| IndexedDB data and synchronization | `src/data/{db,repository,sync,syncController,api,types}.ts`, `src/data/__tests__/*` | Same paths | Database `talas`, version 6, ten entity stores plus `syncState`, dirty/tombstone handling, LWW reconciliation, cursor and stale-lock keys | Root test suite: 7 files, 35 tests passed | Cross-device cloud round trip was not run |
| DynamoDB Lambda and S3 recordings | `backend/index.mjs`, `backend/test-logic.mjs`, `backend/test-sync.mjs`, `src/data/recordings.ts` | Same paths | Sync contract, DynamoDB mapping, S3 presigning, server-side Gemini action | Local Lambda logic test: 6 checks passed | Live Function URL, DynamoDB and S3 were not contacted |
| Gemini intervention and Filipino TTS | `src/services/gemini.ts`, `vite.config.ts`, `backend/index.mjs` | Same paths | Server-only Gemini key, local middleware/Lambda fallback, `/api/tts-fil` proxy | Build passed | Credentialed Gemini and network TTS calls were not made |
| PWA/offline and Vosk model caching | `vite.config.ts`, `src/reading/vosk.ts`, `public/models/README.md` | Same paths | Existing service worker, app shell, runtime caching, offline recognition integration | Production build generated service worker and manifest | Offline reload and Vosk recognition are unverified; no model payload is in the archive |

## Verification and deviations

- `npm ci` — passed from the supplied root lockfile. npm reported 6 dependency advisories (1 low, 3 moderate, 2 high); dependencies were not upgraded.
- `npm run build` — passed; Vite generated the PWA service worker and manifest. Vite warned that the main and Vosk chunks exceed 500 kB.
- `npm test` — passed: 7 test files, 35 tests.
- `npm run lint` — failed on three existing `react-hooks/set-state-in-effect` errors in `src/features/teacher/dashboard/LearnerListTable.tsx`, `src/features/teacher/intervention/InterventionDashboard.tsx`, and `src/features/teacher/learners/LearnersList.tsx`, plus one existing ref cleanup warning in `src/screens/learner/practice/PicturePractice.tsx`. These source files were restored unchanged from the reference archive.
- `backend/npm ci` — passed after reconciling the supplied backend lockfile, which omitted the already-declared `@google/genai` dependency. The lock now includes `@google/genai` 1.43.0 (the declared minimum); the backend `package.json` and AWS SDK locked versions remain unchanged.
- `node backend/test-logic.mjs` — passed: 6 local handler checks.
- `backend/test-sync.mjs` was not run because it writes a smoke-test learner record to a live Function URL. Browser-only responsive, accessibility, microphone, audio, PWA-offline, Gemini, AWS, and visual screenshot checks remain unverified.
- The root `.env` is ignored by the existing `.gitignore` rule. Its values were not printed or copied into source.
