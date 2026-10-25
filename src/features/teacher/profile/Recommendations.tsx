import { Fragment, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Lightbulb, Bandage, Clock } from 'lucide-react'
import {
  learnerProfile,
  type InterventionRecord,
  type InterventionStatus,
} from '../dashboard/sectionData'

const STATUS_META: Record<InterventionStatus, string> = {
  Active: 'bg-sprout-50 text-sprout-500',
  Completed: 'bg-sky-50 text-sky-500',
  Discontinued: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: InterventionStatus }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full font-sans text-xs font-bold ${STATUS_META[status]}`}>
      {status}
    </span>
  )
}

function ProgressTrack({ record }: { record: InterventionRecord }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-sans text-xs">
        <span className="text-gray-400">{record.directive}</span>
        <span className="font-bold text-sprout-500">
          {record.modulesCompleted} of {record.modulesTotal} modules
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: record.modulesTotal }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 rounded-full ${i < record.modulesCompleted ? 'bg-sprout-500' : 'bg-gray-100'}`}
          />
        ))}
      </div>
    </div>
  )
}

/** Intervention History tab — recommendations, active plan + previous interventions. Kept separate from formal records. */
function Recommendations() {
  const { learnerId } = useParams()
  const profile = learnerProfile(learnerId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!profile) return null
  const active = profile.intervention
  const previous = profile.interventionHistory
  const recommendations = profile.recommendations

  return (
    <div className="space-y-6">
      {/* Recommendations — system-generated next steps for this learner */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-lg font-bold text-charcoal">Recommendations</h2>
          <span className="ml-auto font-sans text-xs text-gray-400">
            {recommendations.length} suggested
          </span>
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((r) => (
              <article key={r.id} className="p-4 rounded-xl bg-paper border border-gray-100 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-sans text-sm font-semibold text-charcoal">{r.detail}</p>
                  <span className="px-2 py-0.5 rounded-full bg-buttercup-50 text-buttercup-700 font-sans text-xs font-bold shrink-0">
                    {r.status}
                  </span>
                </div>
                <p className="font-sans text-xs text-gray-400">{r.basis}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="h-9 px-4 rounded-lg bg-sprout-500 hover:opacity-95 text-white font-sans text-sm font-semibold transition-all shadow-sm"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="h-9 px-4 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-charcoal font-sans text-sm font-semibold transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="font-sans text-sm text-gray-400">No recommendations for this learner right now.</p>
        )}
      </section>

      {/* Current / active intervention */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 lg:p-8 space-y-5">
        <div className="flex items-center gap-2">
          <Bandage className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-lg font-bold text-charcoal">Current Intervention</h2>
          {active && <span className="ml-auto"><StatusBadge status={active.status} /></span>}
        </div>

        {active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-sans text-base font-bold text-charcoal">{active.title}</span>
              <span className="px-2 py-0.5 rounded-full bg-buttercup-50 text-buttercup-700 font-sans text-xs font-bold">
                {active.tier}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-paper border border-gray-100 space-y-1">
                <span className="font-sans text-xs text-gray-400 uppercase tracking-wide">Target skill / need</span>
                <p className="font-sans text-sm font-semibold text-charcoal">{active.targetSkill}</p>
              </div>
              <div className="p-4 rounded-xl bg-paper border border-gray-100 space-y-1">
                <span className="font-sans text-xs text-gray-400 uppercase tracking-wide">Date assigned</span>
                <p className="font-sans text-sm font-semibold text-charcoal">{active.dateAssigned}</p>
                <span className="font-sans text-xs text-gray-400">Next: {active.nextSession}</span>
              </div>
            </div>

            <p className="font-sans text-sm text-gray-600">{active.description}</p>

            <ProgressTrack record={active} />
          </div>
        ) : (
          <p className="font-sans text-sm text-gray-400">No active intervention assigned.</p>
        )}
      </section>

      {/* Previous interventions */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4">
          <Clock className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-base font-bold text-charcoal">Previous Interventions</h2>
          <span className="ml-auto font-sans text-xs text-gray-400">{previous.length} on record</span>
        </div>

        {previous.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-y border-gray-100 bg-paper">
                  <th className="px-6 py-3 font-sans text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="px-6 py-3 font-sans text-xs font-semibold text-gray-500 uppercase tracking-wide">Date assigned</th>
                  <th className="px-6 py-3 font-sans text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-6 py-3 font-sans text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((rec) => (
                  <Fragment key={rec.id}>
                    <tr className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3">
                        <span className="font-sans text-sm font-semibold text-charcoal">{rec.title}</span>
                        <span className="block font-sans text-xs text-gray-400">{rec.targetSkill}</span>
                      </td>
                      <td className="px-6 py-3 font-sans text-sm text-gray-600">{rec.dateAssigned}</td>
                      <td className="px-6 py-3"><StatusBadge status={rec.status} /></td>
                      <td className="px-6 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                          className="font-sans text-sm font-semibold text-sprout-500 hover:underline"
                        >
                          {expandedId === rec.id ? 'Hide details' : 'View details'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === rec.id && (
                      <tr className="bg-paper/60">
                        <td colSpan={4} className="px-6 py-4 space-y-3">
                          <p className="font-sans text-sm text-gray-600">{rec.description}</p>
                          <ProgressTrack record={rec} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-6 font-sans text-sm text-gray-400">No previous interventions on record.</p>
        )}
      </section>
    </div>
  )
}

export default Recommendations
