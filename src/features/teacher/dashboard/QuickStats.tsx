import { BarChart3, TriangleAlert, Headphones } from 'lucide-react'
import { useDashboardStats } from './useDashboardStats'

interface QuickStatsProps {
  sectionId?: string
}

/** Small circular SVG progress ring (percentage, 0–100). */
function ProgressRing({ pct }: { pct: number }) {
  const r = 19
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct / 100)
  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
      <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="fill-none stroke-gray-100" cx="24" cy="24" r={r} strokeWidth="4" />
        <circle
          className="fill-none stroke-sprout-500 transition-all duration-700"
          cx="24"
          cy="24"
          r={r}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-sans text-xs font-bold text-charcoal">{pct}%</span>
    </div>
  )
}

function QuickStats({ sectionId = 'all' }: QuickStatsProps) {
  const stats = useDashboardStats(sectionId)
  const assessedPct =
    stats.totalLearners > 0
      ? Math.round((stats.assessedCount / stats.totalLearners) * 100)
      : 0
  const scopeLabel = sectionId === 'all' ? 'across all sections' : 'in this section'

  return (
    <section aria-label="Key assessment metrics" className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* Assessed — with progress ring */}
      <article className="relative overflow-hidden rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-400">
              Assessed
            </span>
            <div className="font-sans text-xl font-bold text-charcoal pt-1">
              {stats.assessedCount} / {stats.totalLearners}
            </div>
            <p className="font-sans text-xs text-gray-500">{scopeLabel}</p>
          </div>
          <ProgressRing pct={assessedPct} />
        </div>
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-sprout-500" aria-hidden />
          <span className="font-sans text-xs text-gray-500">{assessedPct}% completion rate</span>
        </div>
      </article>

      {/* Need Support — pulse indicator */}
      <article className="relative overflow-hidden rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-400">
                Need Support
              </span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-coral-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-coral-500" />
              </span>
            </div>
            <div className="font-sans text-xl font-bold text-charcoal pt-1">
              {stats.needSupportCount}
            </div>
            <p className="font-sans text-xs text-gray-500">MR + FR learners</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-coral-50 flex items-center justify-center shrink-0" aria-hidden="true">
            <TriangleAlert className="w-6 h-6 text-coral-500" aria-hidden />
          </div>
        </div>
        <div className="mt-3 pt-2.5 flex items-center gap-1.5 bg-coral-50 rounded-md px-2.5 py-1.5">
          <Headphones className="w-4 h-4 text-coral-500" aria-hidden />
          <span className="font-sans text-xs text-coral-500 font-medium truncate">
            Requires targeted intervention
          </span>
        </div>
      </article>

      {/* Needs Review */}
      <article className="relative overflow-hidden rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-gray-400">
              Needs Review
            </span>
            <div className="font-sans text-xl font-bold text-charcoal pt-1">
              {stats.needsReviewCount}{' '}
              <span className="font-sans text-base font-semibold text-coral-500">
                {stats.needsReviewCount === 1 ? 'assessment' : 'assessments'}
              </span>
            </div>
            <p className="font-sans text-xs text-gray-500">awaiting your review</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-coral-50 flex items-center justify-center shrink-0" aria-hidden="true">
            <Headphones className="w-6 h-6 text-coral-500" aria-hidden />
          </div>
        </div>
        <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
          <span className="font-sans text-xs text-gray-400">
            {stats.needsReviewCount === 0 ? 'All caught up' : 'More to review'}
          </span>
          <span className="font-sans text-xs text-coral-500 font-semibold">
            {stats.needsReviewCount} pending
          </span>
        </div>
      </article>
    </section>
  )
}

export default QuickStats
