import { useEffect, useState } from 'react'
import {
  listReadingAttemptsByLearner,
  syncNow,
  getRecordingUrl,
  isRecordingStorageConfigured,
  type ReadingAttempt,
} from '../../../data'

/**
 * Loads a SINGLE learner's reading attempts from the local data layer
 * (IndexedDB), filtered strictly to that learnerId — never other students.
 * Triggers a sync first so attempts submitted on another device are pulled in.
 */
export function useReadingAttempts(learnerId: string | undefined): {
  attempts: ReadingAttempt[]
  loading: boolean
  refresh: () => void
} {
  const [attempts, setAttempts] = useState<ReadingAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function readLocal() {
      if (!learnerId) {
        if (!cancelled) {
          setAttempts([])
          setLoading(false)
        }
        return
      }
      const list = await listReadingAttemptsByLearner(learnerId)
      if (!cancelled) {
        setAttempts(list)
        setLoading(false)
      }
    }

    // 1) Read whatever is already local IMMEDIATELY (never blocks on network).
    void readLocal()

    // 2) Sync in the background, then re-read. If sync hangs or fails, the
    //    local read above has already resolved the loading state.
    void (async () => {
      try {
        await syncNow()
      } catch {
        /* offline / no endpoint — local data already shown */
      }
      if (!cancelled) await readLocal()
    })()

    return () => {
      cancelled = true
    }
  }, [learnerId, tick])

  return { attempts, loading, refresh: () => setTick((t) => t + 1) }
}

/**
 * Resolves a stored S3 recording key to a short-lived, playable URL. Returns
 * null when there's no key or storage isn't configured.
 */
export async function resolveRecordingUrl(
  audioKey: string | undefined,
): Promise<string | null> {
  if (!audioKey || !isRecordingStorageConfigured()) return null
  try {
    return await getRecordingUrl(audioKey)
  } catch {
    return null
  }
}
