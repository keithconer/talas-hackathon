/**
 * Vitest setup: install a fake in-memory IndexedDB so the data layer runs
 * under Node. Resets to a clean DB before every test.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach } from "vitest";
import { _resetDbCacheForTests } from "../db";

beforeEach(() => {
  // Brand-new storage per test, and drop the cached DB handle so openDB()
  // re-runs the upgrade and seeds against a clean slate.
  globalThis.indexedDB = new IDBFactory();
  _resetDbCacheForTests();
});
