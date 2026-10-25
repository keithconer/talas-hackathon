import { useEffect, useMemo, useState } from 'react'
import { getAll, syncNow, type ReadingAttempt, type SilentAttempt, type InterventionPlan } from '../../../data'
import { LEARNERS } from '../dashboard/sectionData'

type ReportData = { oral: ReadingAttempt[]; silent: SilentAttempt[]; plans: InterventionPlan[] }

function Reports() {
  const [data, setData] = useState<ReportData>({ oral: [], silent: [], plans: [] })
  const [activeGrade, setActiveGrade] = useState('all')
  const [attentionGrade, setAttentionGrade] = useState('all')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const [oral, silent, plans] = await Promise.all([
        getAll('readingAttempts'), getAll('silentAttempts'), getAll('interventionPlans'),
      ])
      if (!cancelled) setData({ oral: oral.filter((x) => x.deleted !== true), silent: silent.filter((x) => x.deleted !== true), plans: plans.filter((x) => x.deleted !== true) })
    }
    void load()
    void syncNow().then(load).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const grades = ['all', 'Grade 1', 'Grade 2', 'Grade 3']
  const rows = useMemo(() => LEARNERS.map((learner) => {
    const oral = data.oral.filter((x) => x.learnerId === learner.id)
    const silent = data.silent.filter((x) => x.learnerId === learner.id)
    const plans = data.plans.filter((x) => x.learnerId === learner.id)
    const interventionActivities = plans.flatMap((p) => p.activities)
    const activityCount = oral.length + silent.length + interventionActivities.filter((a) => a.result).length
    const scores = [...oral.map((x) => x.accuracy), ...silent.map((x) => x.scorePercent)]
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null
    const interventionCount = plans.length
    const needsAttention = interventionCount > 0 || (average !== null && average < 60)
    return { learner, activityCount, average, interventionCount, needsAttention, lastActive: [...oral, ...silent].map((x) => x.createdAt).sort().at(-1) }
  }), [data])

  const activeRows = rows.filter((x) => activeGrade === 'all' || x.learner.grade.startsWith(activeGrade))
    .sort((a, b) => b.activityCount - a.activityCount || (b.lastActive ?? '').localeCompare(a.lastActive ?? ''))
  const attentionRows = rows.filter((x) => (attentionGrade === 'all' || x.learner.grade.startsWith(attentionGrade)) && x.needsAttention)
    .sort((a, b) => Number(b.interventionCount > 0) - Number(a.interventionCount > 0) || (a.average ?? 101) - (b.average ?? 101))

  const filter = (value: string, onChange: (v: string) => void) => <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"><option value="all">All grades</option>{grades.slice(1).map((grade) => <option key={grade}>{grade}</option>)}</select>
  const reportTable = (items: typeof rows, empty: string) => items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-gray-500"><tr><th className="py-2">Student</th><th>Grade</th><th>Activities</th><th>Avg. score</th><th>Intervention plans</th></tr></thead><tbody>{items.map((row) => <tr key={row.learner.id} className="border-t border-gray-100"><td className="py-3 font-medium">{row.learner.name}</td><td>{row.learner.grade}</td><td>{row.activityCount}</td><td>{row.average === null ? 'No scores yet' : `${row.average}%`}</td><td>{row.interventionCount}</td></tr>)}</tbody></table></div> : <p className="py-6 text-center text-sm text-gray-500">{empty}</p>

  return <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-1"><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-gray-500">Student activity, performance, and learners who may need more support.</p></header>
    <section className="rounded-xl bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Most active students</h2><p className="text-xs text-gray-500">Ranked by completed oral, silent, and intervention activities.</p></div>{filter(activeGrade, setActiveGrade)}</div>{reportTable(activeRows, 'No student activities recorded yet.')}</section>
    <section className="rounded-xl bg-white p-5 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Needs attention for improvement</h2><p className="text-xs text-gray-500">Includes students with an intervention plan or an average recorded score below 60%.</p></div>{filter(attentionGrade, setAttentionGrade)}</div>{reportTable(attentionRows, 'No learners currently meet these criteria.')}</section>
  </div>
}

export default Reports
