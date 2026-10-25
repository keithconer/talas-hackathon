/**
 * TALAS — seed data + idempotent seeding routine (Hour 1 Foundation).
 *
 * Seeds a known starting state so the app is demoable immediately:
 *   - one teacher
 *   - two learners: Maria & Amina
 *   - one assessment (a short math quiz)
 *   - one assignment: that assessment given to Maria
 *
 * `seedDatabase()` is idempotent — it only writes when stores are empty, so it
 * is safe to call on every app startup.
 */

import { STORES } from "./types";
import type {
  Assessment,
  Assignment,
  Learner,
  ReadingPassage,
  Teacher,
} from "./types";
import { count, openDB, put } from "./db";

/** Counts whitespace-separated words in a passage body. */
function words(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

/** Fixed timestamp so seeded data is deterministic across runs. */
const SEED_TIME = "2026-10-03T09:00:00.000Z";

export const TEACHER: Teacher = {
  id: "teacher-bert",
  name: "Bert",
  email: "bert@talas.app",
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const LEARNER_MARIA: Learner = {
  id: "learner-maria",
  name: "Maria",
  displayName: "Maria",
  grade: "Grade 7",
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const LEARNER_AMINA: Learner = {
  id: "learner-amina",
  name: "Amina",
  displayName: "Amina",
  grade: "Grade 7",
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const ASSESSMENT_MATH: Assessment = {
  id: "assessment-math-basics",
  title: "Math Basics Quiz",
  description: "A short warm-up covering arithmetic fundamentals.",
  subject: "Mathematics",
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
  questions: [
    {
      id: "q1",
      prompt: "What is 7 + 5?",
      type: "multiple-choice",
      choices: ["10", "11", "12", "13"],
      answer: 2,
      points: 1,
    },
    {
      id: "q2",
      prompt: "What is 9 × 3?",
      type: "multiple-choice",
      choices: ["18", "24", "27", "30"],
      answer: 2,
      points: 1,
    },
    {
      id: "q3",
      prompt: "Write the number that comes after 199.",
      type: "short-answer",
      answer: "200",
      points: 1,
    },
  ],
};

/** The one seeded assignment: Math Basics given to Maria by Bert. */
export const ASSIGNMENT_MARIA_MATH: Assignment = {
  id: "assignment-maria-math",
  assessmentId: ASSESSMENT_MATH.id,
  learnerId: LEARNER_MARIA.id,
  assignedBy: TEACHER.id,
  status: "assigned",
  assignedAt: SEED_TIME,
  dueAt: "2026-10-10T09:00:00.000Z",
  updatedAt: SEED_TIME,
};

/* ------------------------------------------------------- Reading passages */
/* Short Filipino stories for the oral reading assessment, by difficulty. */

const PASSAGE_1_BODY =
  "Si Bruno ay isang masayang palaka. Tumatalon siya sa mga lawa. " +
  "Gustong-gusto niyang kumain ng gulay. Tuwing umaga ay naliligo siya sa ilog.";

const PASSAGE_2_BODY =
  "Maaga pang nagising si Lila. Inayos niya ang kaniyang mga libro at lapis. " +
  "Naglakad siya patungo sa paaralan kasama ang kaniyang aso. " +
  "Sa daan ay nakita niya ang mga ibong lumilipad sa malinaw na langit.";

const PASSAGE_3_BODY =
  "Noong unang panahon, may isang matalinong batang nagngangalang Dalisay. " +
  "Mahilig siyang magbasa ng mga kuwento tungkol sa mga bituin at planeta. " +
  "Isang gabi, nanaginip siyang naglalakbay sa kalawakan sakay ng isang bangkang gawa sa papel. " +
  "Natuto siyang ang tunay na kayamanan ay nasa katanungan at pangarap.";

export const PASSAGE_BRUNO: ReadingPassage = {
  id: "passage-bruno",
  title: "Si Bruno ang Palaka",
  body: PASSAGE_1_BODY,
  level: "antas-1",
  wordCount: words(PASSAGE_1_BODY),
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const PASSAGE_LILA: ReadingPassage = {
  id: "passage-lila",
  title: "Ang Umaga ni Lila",
  body: PASSAGE_2_BODY,
  level: "antas-2",
  wordCount: words(PASSAGE_2_BODY),
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const PASSAGE_DALISAY: ReadingPassage = {
  id: "passage-dalisay",
  title: "Ang Pangarap ni Dalisay",
  body: PASSAGE_3_BODY,
  level: "antas-3",
  wordCount: words(PASSAGE_3_BODY),
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};

export const READING_PASSAGES: ReadingPassage[] = [
  PASSAGE_BRUNO,
  PASSAGE_LILA,
  PASSAGE_DALISAY,
];

/**
 * Seeds the database once. Returns `true` if seed data was written, `false` if
 * the DB already had data and seeding was skipped.
 */
export async function seedDatabase(): Promise<boolean> {
  // Make sure the stores exist before we count/write.
  await openDB();

  // Reading passages are seeded independently so users upgrading from an
  // earlier DB version (who already have learners/assessments) still get them.
  let wrote = false;
  if ((await count(STORES.readingPassages)) === 0) {
    for (const passage of READING_PASSAGES) {
      await put(STORES.readingPassages, { ...passage, dirty: true });
    }
    wrote = true;
  }

  const existing =
    (await count(STORES.learners)) +
    (await count(STORES.teachers)) +
    (await count(STORES.assessments)) +
    (await count(STORES.assignments));

  if (existing > 0) {
    return wrote;
  }

  // Mark seeded records `dirty` so the first sync pushes them to the backend.
  // (Without this, seed data would only ever live locally until it was edited.)
  await put(STORES.teachers, { ...TEACHER, dirty: true });
  await put(STORES.learners, { ...LEARNER_MARIA, dirty: true });
  await put(STORES.learners, { ...LEARNER_AMINA, dirty: true });
  await put(STORES.assessments, { ...ASSESSMENT_MATH, dirty: true });
  await put(STORES.assignments, { ...ASSIGNMENT_MARIA_MATH, dirty: true });

  return true;
}
