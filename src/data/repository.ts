/**
 * TALAS — repository layer (offline/online sync).
 */

import {
  getAll,
  get,
  put,
  getAssignmentsByLearner,
  getReadingAttemptsByLearner,
  getSilentAttemptsByLearner,
  getPictureAttemptsByLearner,
  getScreeningAssessmentsByLearner,
  getInterventionPlansByLearner,
} from "./db";
import type { Entity, StoreEntityMap, StoreName } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function isLive(record: Entity): boolean {
  return record.deleted !== true;
}

export async function save<K extends StoreName>(
  storeName: K,
  entity: StoreEntityMap[K],
): Promise<StoreEntityMap[K]> {
  const stamped: StoreEntityMap[K] = {
    ...entity,
    updatedAt: nowIso(),
    dirty: true,
  };
  await put(storeName, stamped);
  return stamped;
}

export async function softDelete<K extends StoreName>(
  storeName: K,
  id: string,
): Promise<boolean> {
  const existing = await get(storeName, id);
  if (!existing) return false;

  const tombstone: StoreEntityMap[K] = {
    ...existing,
    deleted: true,
    dirty: true,
    updatedAt: nowIso(),
  };
  await put(storeName, tombstone);
  return true;
}

export async function list<K extends StoreName>(
  storeName: K,
): Promise<StoreEntityMap[K][]> {
  const all = await getAll(storeName);
  return all.filter(isLive);
}

export async function getById<K extends StoreName>(
  storeName: K,
  id: string,
): Promise<StoreEntityMap[K] | undefined> {
  const record = await get(storeName, id);
  if (!record || !isLive(record)) return undefined;
  return record;
}

export const putRecord = save;
export const listRecords = list;
export const getRecord = getById;

export async function listAssignmentsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["assignments"][]> {
  const all = await getAssignmentsByLearner(learnerId);
  return all.filter(isLive);
}

export async function listReadingAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["readingAttempts"][]> {
  let all: StoreEntityMap["readingAttempts"][];
  try {
    all = await getReadingAttemptsByLearner(learnerId);
  } catch {
    const everything = await getAll("readingAttempts");
    all = everything.filter((a) => a.learnerId === learnerId);
  }
  return all
    .filter(isLive)
    .sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
}

export async function listSilentAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["silentAttempts"][]> {
  let all: StoreEntityMap["silentAttempts"][];
  try {
    all = await getSilentAttemptsByLearner(learnerId);
  } catch {
    const everything = await getAll("silentAttempts");
    all = everything.filter((a) => a.learnerId === learnerId);
  }
  return all
    .filter(isLive)
    .sort((a, b) =>
      b.createdAt === a.createdAt
        ? b.id.localeCompare(a.id)
        : b.createdAt.localeCompare(a.createdAt),
    );
}

export async function listPictureAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["pictureAttempts"][]> {
  let all: StoreEntityMap["pictureAttempts"][];
  try {
    all = await getPictureAttemptsByLearner(learnerId);
  } catch {
    const everything = await getAll("pictureAttempts");
    all = everything.filter((a) => a.learnerId === learnerId);
  }
  return all
    .filter(isLive)
    .sort((a, b) =>
      b.createdAt === a.createdAt
        ? b.id.localeCompare(a.id)
        : b.createdAt.localeCompare(a.createdAt),
    );
}

/** Lists live Reading Intervention Screening records for a learner, newest first. */
export async function listScreeningAssessmentsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["screeningAssessments"][]> {
  let all: StoreEntityMap["screeningAssessments"][];
  try {
    all = await getScreeningAssessmentsByLearner(learnerId);
  } catch {
    const everything = await getAll("screeningAssessments");
    all = everything.filter((a) => a.learnerId === learnerId);
  }
  return all
    .filter(isLive)
    .sort((a, b) =>
      b.createdAt === a.createdAt
        ? b.id.localeCompare(a.id)
        : b.createdAt.localeCompare(a.createdAt),
    );
}

/** Lists live InterventionPlan records for a learner, newest first. */
export async function listInterventionPlansByLearner(
  learnerId: string,
): Promise<StoreEntityMap["interventionPlans"][]> {
  let all: StoreEntityMap["interventionPlans"][];
  try {
    all = await getInterventionPlansByLearner(learnerId);
  } catch {
    const everything = await getAll("interventionPlans");
    all = everything.filter((a) => a.learnerId === learnerId);
  }
  return all
    .filter(isLive)
    .sort((a, b) =>
      b.createdAt === a.createdAt
        ? b.id.localeCompare(a.id)
        : b.createdAt.localeCompare(a.createdAt),
    );
}
