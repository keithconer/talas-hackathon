import { learnersForSection, isLearnerActive } from './sectionData'
import { useSubmissions } from './useSubmissions'
import { profileFromAccuracy } from '../../../reading/crla'

/** Aggregate counts shown in the dashboard quick-stats row. */
export interface DashboardStats {
  totalLearners: number
  assessedCount: number
  needSupportCount: number
  activeTodayCount: number
  needsReviewCount: number
}

/**
 * Derives dashboard stats from REAL submitted reading attempts (not the static
 * roster). A learner counts as "assessed" once they have at least one attempt;
 * "need support" if their best CRLA level is a Moderate or Full Refresher (the
 * profiles that require structured/intensive intervention); "needs review" is
 * the total number of submissions in scope; "active today" reflects live
 * sessions.
 */
export function useDashboardStats(sectionId: string = 'all'): DashboardStats {
  const learners = learnersForSection(sectionId)
  const { byLearner } = useSubmissions()

  let assessedCount = 0
  let needSupportCount = 0
  let needsReviewCount = 0
  let activeTodayCount = 0

  for (const l of learners) {
    const attempts = byLearner[l.id] ?? []
    if (attempts.length > 0) {
      assessedCount++
      needsReviewCount += attempts.length
      const bestAccuracy = Math.max(...attempts.map((a) => a.accuracy))
      const level = profileFromAccuracy(bestAccuracy)
      if (level === 'MR' || level === 'FR') needSupportCount++
    }
    if (isLearnerActive(l.id)) activeTodayCount++
  }

  return {
    totalLearners: learners.length,
    assessedCount,
    needSupportCount,
    activeTodayCount,
    needsReviewCount,
  }
}
