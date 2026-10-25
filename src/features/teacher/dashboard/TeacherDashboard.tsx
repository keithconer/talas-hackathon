import { useState } from 'react'
import DashboardHeader from './DashboardHeader'
import SectionSelector from './SectionSelector'
import QuickStats from './QuickStats'
import ClassDistribution from './ClassDistribution'
import RecentActivity from './RecentActivity'
import LearnerListTable from './LearnerListTable'

/**
 * Teacher Dashboard page (route `/teacher`). Rendered inside <AppLayout>.
 * Greeting + section selector up top, a metric row, then an 8/4 two-column
 * grid. The section selector filters stats, distribution, and the roster.
 */
function TeacherDashboard() {
  const [sectionId, setSectionId] = useState('all')

  return (
    <div className="relative">
      {/* Ambient backdrop glow */}
      <div className="absolute -top-10 -right-8 w-96 h-96 bg-sprout-50 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 -left-12 w-80 h-80 bg-sky-50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="space-y-5">
        {/* Header + controls */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <DashboardHeader />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <SectionSelector value={sectionId} onChange={setSectionId} />
          </div>
        </div>

        {/* Metric row */}
        <QuickStats sectionId={sectionId} />

        {/* Two-column grid: 8 / 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          <div className="lg:col-span-8 space-y-4">
            <ClassDistribution sectionId={sectionId} />
            <LearnerListTable sectionId={sectionId} />
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <RecentActivity />
          </aside>
        </div>
      </div>
    </div>
  )
}

export default TeacherDashboard
