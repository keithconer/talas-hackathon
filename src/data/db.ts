/**
 * TALAS — IndexedDB access layer (Hour 1 Foundation + Intervention v6).
 */

import { STORES, SYNC_STATE_STORE } from "./types";
import type { StoreEntityMap, StoreName } from "./types";

const DB_NAME = "talas";
/**
 * v1: initial entity stores.
 * v2: added the `syncState` key-value store for offline/online sync.
 * v3: added `readingPassages` + `readingAttempts` stores (oral reading assessment).
 * v4: added `silentAttempts` store (silent-reading comprehension results).
 * v5: added `pictureAttempts` store (Salita at Larawan results, separate from oral/silent).
 * v6: added `screeningAssessments` + `interventionPlans` stores (Grades 1–3 intervention).
 */
const DB_VERSION = 6;

let dbPromise: Promise<IDBDatabase> | null = null;

/** Opens (and upgrades, if needed) the TALAS database. Cached after first call. */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });

          if (name === STORES.assignments) {
            store.createIndex("by_learner", "learnerId", { unique: false });
            store.createIndex("by_assessment", "assessmentId", {
              unique: false,
            });
          }

          if (name === STORES.readingAttempts) {
            store.createIndex("by_learner", "learnerId", { unique: false });
            store.createIndex("by_passage", "passageId", { unique: false });
          }

          if (name === STORES.silentAttempts) {
            store.createIndex("by_learner", "learnerId", { unique: false });
          }

          if (name === STORES.pictureAttempts) {
            store.createIndex("by_learner", "learnerId", { unique: false });
          }

          if (name === STORES.screeningAssessments) {
            store.createIndex("by_learner", "learnerId", { unique: false });
          }

          if (name === STORES.interventionPlans) {
            store.createIndex("by_learner", "learnerId", { unique: false });
          }
        }
      }

      if (!db.objectStoreNames.contains(SYNC_STATE_STORE)) {
        db.createObjectStore(SYNC_STATE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export function _resetDbCacheForTests(): void {
  dbPromise = null;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);

    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getAll<K extends StoreName>(
  storeName: K,
): Promise<StoreEntityMap[K][]> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.getAll() as IDBRequest<StoreEntityMap[K][]>);
}

export async function get<K extends StoreName>(
  storeName: K,
  id: string,
): Promise<StoreEntityMap[K] | undefined> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(
    store.get(id) as IDBRequest<StoreEntityMap[K] | undefined>,
  );
}

export async function add<K extends StoreName>(
  storeName: K,
  value: StoreEntityMap[K],
): Promise<string> {
  return withStore(storeName, "readwrite", (store) =>
    store.add(value),
  ) as Promise<string>;
}

export async function put<K extends StoreName>(
  storeName: K,
  value: StoreEntityMap[K],
): Promise<string> {
  return withStore(storeName, "readwrite", (store) =>
    store.put(value),
  ) as Promise<string>;
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.delete(id));
}

export async function count(storeName: StoreName): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  return promisifyRequest(store.count());
}

export async function getAssignmentsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["assignments"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.assignments, "readonly");
  const index = tx.objectStore(STORES.assignments).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["assignments"][]>,
  );
}

export async function getReadingAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["readingAttempts"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.readingAttempts, "readonly");
  const index = tx.objectStore(STORES.readingAttempts).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["readingAttempts"][]>,
  );
}

export async function getSilentAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["silentAttempts"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.silentAttempts, "readonly");
  const index = tx.objectStore(STORES.silentAttempts).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["silentAttempts"][]>,
  );
}

export async function getPictureAttemptsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["pictureAttempts"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.pictureAttempts, "readonly");
  const index = tx.objectStore(STORES.pictureAttempts).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["pictureAttempts"][]>,
  );
}

export async function getScreeningAssessmentsByLearner(
  learnerId: string,
): Promise<StoreEntityMap["screeningAssessments"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.screeningAssessments, "readonly");
  const index = tx.objectStore(STORES.screeningAssessments).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["screeningAssessments"][]>,
  );
}

export async function getInterventionPlansByLearner(
  learnerId: string,
): Promise<StoreEntityMap["interventionPlans"][]> {
  const db = await openDB();
  const tx = db.transaction(STORES.interventionPlans, "readonly");
  const index = tx.objectStore(STORES.interventionPlans).index("by_learner");
  return promisifyRequest(
    index.getAll(learnerId) as IDBRequest<StoreEntityMap["interventionPlans"][]>,
  );
}

export async function getSyncState<T = unknown>(
  key: string,
): Promise<T | undefined> {
  const db = await openDB();
  const tx = db.transaction(SYNC_STATE_STORE, "readonly");
  const store = tx.objectStore(SYNC_STATE_STORE);
  return promisifyRequest(store.get(key) as IDBRequest<T | undefined>);
}

export async function setSyncState(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYNC_STATE_STORE, "readwrite");
    tx.objectStore(SYNC_STATE_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function deleteSyncState(key: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SYNC_STATE_STORE, "readwrite");
    tx.objectStore(SYNC_STATE_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
