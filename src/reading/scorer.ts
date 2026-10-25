/**
 * TALAS — oral reading scorer.
 *
 * Compares what a learner *said* (a transcript, from the Web Speech API online
 * or a manual/offline transcript) against the *expected* passage, word by word,
 * and returns an accuracy score plus a per-word correct/incorrect breakdown.
 *
 * This runs entirely on-device with no network, so scoring works identically
 * offline and online — the only part that may need a connection is the speech
 * recognizer that produces the transcript (handled in `useSpeechRecognition`).
 *
 * Matching strategy: we normalize both sides (lowercase, strip punctuation and
 * Filipino-relevant diacritics), expand hyphenated words into parts, then run a
 * greedy in-order alignment (the same one used for live highlighting) so the
 * final result matches what the learner saw while reading. A skipped word
 * doesn't cascade every later word into "wrong".
 */

import type { WordResult } from "../data/types";
import { accuracyEncouragement } from "./crla";

/**
 * Normalizes a single token for comparison:
 *   "Masayang," -> "masayang",  "Niño" -> "nino"
 * Keeps letters/numbers only, folds diacritics, lowercases.
 */
export function normalizeWord(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9ñ]/g, ""); // keep ñ (common in Filipino), drop punctuation
}

/** Splits a passage/transcript into display tokens (whitespace-separated). */
export function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Expands a display token into one or more normalized sub-words.
 *
 * Hyphenated Filipino words ("gustong-gusto", "araw-araw", "pag-asa") are a
 * SINGLE passage token, but a speech recognizer returns them as separate words
 * ("gusto gusto"). If we normalized the whole thing to "gustonggusto" it would
 * never match. So we split on hyphens/en-dashes and normalize each part, and a
 * display word only counts as correct when ALL of its parts are matched.
 */
export function expandToken(displayToken: string): string[] {
  return displayToken
    .split(/[-\u2010-\u2015\u2212]/) // hyphen + unicode dashes
    .map(normalizeWord)
    .filter(Boolean);
}

/**
 * Normalizes a display token to a single JOINED form (letters/numbers only).
 * A hyphenated repeated word collapses to one unit, e.g.
 *   "araw-araw" -> "arawaraw",  "paru-paro," -> "paruparo".
 * This is how recognizers typically emit repeated words (one joined token).
 */
export function joinedNormal(displayToken: string): string {
  return expandToken(displayToken).join('') || normalizeWord(displayToken);
}

/**
 * Pre-merges adjacent spoken tokens whose concatenation exactly equals an
 * expected joined word. Handles the case where the recognizer split a repeated
 * word into two tokens ("paru paro") when the passage has it as one word
 * ("paru-paro" -> expected "paruparo"). Only merges when the joined pair is in
 * the expected set, so normal word pairs are left untouched.
 */
function mergeSplitRepeats(spoken: string[], expectedSet: Set<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < spoken.length; i++) {
    const pair = i + 1 < spoken.length ? spoken[i] + spoken[i + 1] : '';
    if (pair && expectedSet.has(pair)) {
      out.push(pair);
      i++; // consume the next token too
    } else {
      out.push(spoken[i]);
    }
  }
  return out;
}

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Fuzzy word equality. Exact match, or a near-match that tolerates small
 * recognizer errors: 1 edit for medium words, 2 for long words. Short words
 * (<= 3 letters, e.g. "ang", "sa") must match exactly to avoid false hits.
 */
export function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len <= 3) return false;
  const allowed = len >= 7 ? 2 : 1;
  return editDistance(a, b) <= allowed;
}

/**
 * Global sequence alignment (Needleman–Wunsch) of `spoken` onto `expected`.
 *
 * This replaces the old greedy left-to-right matcher, which caused two bugs:
 *   - a repeated word could match the WRONG occurrence (marking a later
 *     duplicate correct and skipping the one the reader actually read), and
 *   - a correctly-read word got marked wrong when the matcher jumped the cursor
 *     past it to re-sync after a dropped recognizer token.
 *
 * A full DP alignment finds the globally optimal pairing between the expected
 * words and the spoken words, so matches land in their correct positions,
 * duplicates align to the right occurrence, and a single dropped/extra token
 * doesn't cascade into everything after it.
 *
 * Returns, for each expected word, whether it was matched and which spoken
 * word index it aligned to (-1 if none) — the latter drives word-level timing.
 */
function alignSequential(
  expected: string[],
  spoken: string[],
): { mask: boolean[]; spokenIndex: number[] } {
  const n = expected.length;
  const m = spoken.length;

  // Scoring: reward a (fuzzy) match, penalize mismatch and gaps.
  const MATCH = 2;
  const MISMATCH = -1;
  const GAP = -1;

  // dp[i][j] = best alignment score of expected[0..i) vs spoken[0..j).
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) dp[i][0] = i * GAP;
  for (let j = 1; j <= m; j++) dp[0][j] = j * GAP;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diagScore =
        dp[i - 1][j - 1] +
        (wordsMatch(expected[i - 1], spoken[j - 1]) ? MATCH : MISMATCH);
      const up = dp[i - 1][j] + GAP; // expected word unmatched (skipped)
      const left = dp[i][j - 1] + GAP; // spoken word unmatched (extra/noise)
      dp[i][j] = Math.max(diagScore, up, left);
    }
  }

  // Backtrack to recover the alignment.
  const mask = new Array<boolean>(n).fill(false);
  const spokenIndex = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const isMatch = wordsMatch(expected[i - 1], spoken[j - 1]);
    const diagScore = dp[i - 1][j - 1] + (isMatch ? MATCH : MISMATCH);
    if (dp[i][j] === diagScore) {
      // Expected word i-1 aligns with spoken word j-1.
      if (isMatch) {
        mask[i - 1] = true;
        spokenIndex[i - 1] = j - 1;
      }
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + GAP) {
      // Expected word i-1 was skipped (not read).
      i--;
    } else {
      // Spoken word j-1 was extra/noise.
      j--;
    }
  }

  return { mask, spokenIndex };
}

export interface ReadingScore {
  accuracy: number; // 0–100
  correctWords: number;
  totalWords: number;
  words: WordResult[];
}

/**
 * Scores a reading attempt. `passage` is the original story text; `transcript`
 * is whatever the recognizer/learner produced.
 */
export function scoreReading(passage: string, transcript: string): ReadingScore {
  const expectedDisplay = tokenize(passage);

  // Each passage word becomes ONE normalized unit using its JOINED form, so a
  // repeated word ("araw-araw", "paru-paro") is treated as a single word
  // "arawaraw" / "paruparo". This matters because speech recognizers usually
  // return a repeated word as one joined token, not two.
  const expectedNorm = expectedDisplay.map((t) => joinedNormal(t));

  // The spoken side may contain the repeated word EITHER joined ("paruparo")
  // or split into two tokens ("paru paro"). Pre-merge adjacent spoken tokens
  // whose concatenation equals an expected joined word, so both forms align.
  const spokenNorm = mergeSplitRepeats(
    tokenize(transcript).map(normalizeWord).filter(Boolean),
    new Set(expectedNorm),
  )

  const { mask, spokenIndex } = alignSequential(expectedNorm, spokenNorm)

  const words: WordResult[] = expectedDisplay.map((word, index) => ({
    index,
    expected: word,
    correct: mask[index] === true,
    spokenIndex: spokenIndex[index],
  }));

  const totalWords = expectedDisplay.length;
  const correctWords = words.reduce((n, w) => n + (w.correct ? 1 : 0), 0);
  const accuracy =
    totalWords === 0 ? 0 : Math.round((correctWords / totalWords) * 100);

  return { accuracy, correctWords, totalWords, words };
}

export interface ReadingProgress {
  /** Per-passage-word mask: true once the reader has read that word in order. */
  read: boolean[];
  /** Index of the next word the reader is expected to say (the cursor). */
  cursor: number;
}

/**
 * Position-aware live progress for highlighting while the learner reads.
 *
 * Unlike a global "have we heard this word anywhere" check, this walks the
 * spoken words through the passage *in order* and only advances a cursor. So:
 *   - saying a word that appears later in the passage does NOT light it up
 *     early (we only match at/near the current cursor),
 *   - repeated words (e.g. "ang" ... "ang") are matched to their own position
 *     one at a time, instead of all lighting at once,
 *   - a single skipped/misheard word doesn't stall progress — a small lookahead
 *     window lets the cursor skip ahead by at most `window` words to re-sync.
 *
 * This drives the live UI; `scoreReading` uses the same alignment strategy so
 * the final result agrees with what was highlighted during reading.
 */
export function readingProgress(
  passage: string,
  transcript: string,
  window = 2,
): ReadingProgress {
  const displayTokens = tokenize(passage);

  // One joined unit per display word, so repeated words ("araw-araw") are a
  // single unit — consistent with scoreReading.
  const expected = displayTokens.map((t) => joinedNormal(t));

  // Merge spoken tokens that reconstruct a joined repeated word ("paru paro").
  const spoken = mergeSplitRepeats(
    tokenize(transcript).map(normalizeWord).filter(Boolean),
    new Set(expected),
  );

  const read = new Array<boolean>(displayTokens.length).fill(false);
  let cursor = 0;
  for (const word of spoken) {
    if (cursor >= expected.length) break;
    // Match at the cursor or up to `window` words ahead to tolerate a small
    // skip; mark the words passed as read and advance the cursor.
    let matchedAt = -1;
    for (let k = 0; k <= window && cursor + k < expected.length; k++) {
      if (wordsMatch(expected[cursor + k], word)) {
        matchedAt = cursor + k;
        break;
      }
    }
    if (matchedAt >= 0) {
      for (let i = cursor; i <= matchedAt; i++) read[i] = true;
      cursor = matchedAt + 1;
    }
    // No match within the window: treat as noise, keep the cursor.
  }

  let displayCursor = read.findIndex((r) => !r);
  if (displayCursor === -1) displayCursor = displayTokens.length;

  return { read, cursor: displayCursor };
}

/**
 * Maps an accuracy score to a learner-friendly band + label. Thresholds come
 * from the CRLA standard (see `crla.ts`) so the learner's encouragement is
 * consistent with the proficiency level the teacher sees.
 */
export function accuracyBand(accuracy: number): {
  tone: "strong" | "ok" | "weak";
  label: string;
} {
  return accuracyEncouragement(accuracy);
}
