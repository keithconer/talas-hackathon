import { Fragment, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Mic,
  BookOpenCheck,
  Lock,
  Clock,
  Settings,
  ShieldCheck,
  Plus,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import Pagination from '../shared/Pagination'

const PAGE_SIZE = 8
import {
  learnerProfile,
  crlaLabel,
  type FormalAssessmentRecord,
  type FormalAssessmentType,
} from '../dashboard/sectionData'

const TYPE_META: Record<FormalAssessmentType, { icon: LucideIcon; chip: string; desc: string }> = {
  Oral: { icon: Mic, chip: 'bg-coral-50 text-coral-500', desc: 'Read-aloud · miscue & fluency' },
  Silent: { icon: BookOpenCheck, chip: 'bg-sky-50 text-sky-500', desc: 'Silent reading · comprehension' },
}

function TypeBadge({ type }: { type: FormalAssessmentType }) {
  const meta = TYPE_META[type]
  const TypeIcon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans text-xs font-bold ${meta.chip}`}>
      <TypeIcon className="w-4 h-4" aria-hidden />
      {type}
    </span>
  )
}

function FinalizedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sprout-50 text-sprout-500 font-sans text-xs font-bold">
      <Lock className="w-3.5 h-3.5" aria-hidden /> Finalized
    </span>
  )
}

/** Read-only evidence detail block for a single formal record. */
function RecordDetail({ record }: { record: FormalAssessmentRecord }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-paper border border-gray-100 rounded-xl p-4 space-y-1">
        <span className="font-sans text-xs text-gray-400 uppercase tracking-wide">Classification</span>
        <p className="font-sans text-sm font-bold text-charcoal">{record.classification}</p>
        <p className="font-sans text-sm text-gray-600">{record.readerStage}</p>
        <span className="font-sans text-xs text-gray-400">{record.period}</span>
      </div>
      <div className="bg-paper border border-gray-100 rounded-xl p-4 space-y-1">
        <span className="font-sans text-xs text-gray-400 uppercase tracking-wide">Date finalized</span>
        <p className="font-sans text-sm font-bold text-charcoal">{record.dateFinalized}</p>
        <span className="font-sans text-xs text-gray-400">Assessed by {record.assessor}</span>
      </div>
      <div className="bg-paper border border-gray-100 rounded-xl p-4 space-y-1">
        <span className="font-sans text-xs text-gray-400 uppercase tracking-wide">Key evidence</span>
        <p className="font-sans text-sm font-bold text-charcoal">{record.miscues}</p>
        <span className="font-sans text-xs text-gray-500">{record.comprehension}</span>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="font-sans text-xs text-gray-400">Phonemes:</span>
          {record.phonemesFlagged.map((p) => (
            <span key={p} className="px-1.5 py-0.5 bg-crla-fr/15 text-crla-fr rounded font-sans text-xs font-bold">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

const TYPE_ORDER: FormalAssessmentType[] = ['Oral', 'Silent']

/** Segmented slider control for switching between Oral and Silent records. */
function TypeSlider({
  value,
  available,
  onChange,
}: {
  value: FormalAssessmentType
  available: Set<FormalAssessmentType>
  onChange: (type: FormalAssessmentType) => void
}) {
  const activeIndex = TYPE_ORDER.indexOf(value)
  return (
    <div
      role="tablist"
      aria-label="Formal assessment type"
      className="relative inline-flex items-center p-1 rounded-full bg-paper border border-gray-200"
    >
      {/* Sliding highlight pill */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-sm border border-gray-200 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {TYPE_ORDER.map((type) => {
        const meta = TYPE_META[type]
        const TypeIcon = meta.icon
        const isActive = value === type
        const isAvailable = available.has(type)
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={!isAvailable}
            onClick={() => isAvailable && onChange(type)}
            className={`relative z-10 inline-flex items-center justify-center gap-1.5 w-22 py-1.5 rounded-full font-sans text-xs font-bold transition-colors ${
              isActive ? 'text-charcoal' : 'text-gray-400 hover:text-gray-600'
            } ${!isAvailable ? 'opacity-40 cursor-not-allowed hover:text-gray-400' : ''}`}
          >
            <TypeIcon className="w-4 h-4" aria-hidden />
            {type}
          </button>
        )
      })}
    </div>
  )
}

/** Formal Assessments tab — finalized, read-only CRLA records with history. */
function FormalAssessment() {
  const { learnerId } = useParams()
  const navigate = useNavigate()
  const profile = learnerProfile(learnerId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const history = profile?.formalHistory ?? []
  const latest = history[0] ?? null
  const [activeType, setActiveType] = useState<FormalAssessmentType>(latest?.type ?? 'Oral')
  const [historyPage, setHistoryPage] = useState(1)
  const currentHistoryPage = Math.min(historyPage, Math.max(1, Math.ceil(history.length / PAGE_SIZE)))
  const visibleHistory = history.slice((currentHistoryPage - 1) * PAGE_SIZE, currentHistoryPage * PAGE_SIZE)

  if (!profile) return null

  const previous = history.slice(1)

  // Latest record of the currently-selected type (falls back to overall latest).
  const availableTypes = new Set(history.map((r) => r.type))
  const selected = history.find((r) => r.type === activeType) ?? latest

  return (
    <div className="space-y-6">
      {/* 1. LATEST FORMAL ASSESSMENT */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Lock className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-sm font-semibold text-charcoal">Latest Formal Assessment</h2>
          <div className="ml-auto flex items-center gap-2">
            <TypeSlider value={activeType} available={availableTypes} onChange={setActiveType} />
            <FinalizedBadge />
          </div>
        </div>

        {selected ? (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-3xl font-bold text-charcoal">
                {profile.record.level ?? '—'}
              </span>
              <span className="inline-flex px-2.5 py-1 rounded-full bg-crla-fr/15 text-crla-fr font-sans text-xs font-bold">
                {crlaLabel(profile.record.level)}
              </span>
              <span className="font-sans text-sm text-gray-500">
                {TYPE_META[selected.type].desc} · {selected.dateFinalized}
              </span>
            </div>

            <RecordDetail record={selected} />

            <p className="font-sans text-xs text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden /> Locked evidence — this
              finalized record is read-only. Practice sessions and daily activities do not
              overwrite it.
            </p>
          </div>
        ) : (
          <p className="p-6 font-sans text-sm text-gray-400">No formal assessment on record yet.</p>
        )}
      </section>

      {/* 2. ASSESSMENT HISTORY */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <Clock className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-sm font-semibold text-charcoal">Assessment History</h2>
          <span className="ml-auto font-sans text-xs text-gray-400">{history.length} on record</span>
        </div>

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-y border-gray-100 bg-paper">
                  <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Result</th>
                  <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 font-sans text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleHistory.map((rec) => (
                  <Fragment key={rec.id}>
                    <tr className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2.5 font-sans text-xs text-charcoal">
                        {rec.dateFinalized}
                        <span className="block font-sans text-xs text-gray-400">{rec.period}</span>
                      </td>
                      <td className="px-4 py-2.5"><TypeBadge type={rec.type} /></td>
                      <td className="px-4 py-2.5 font-sans text-xs text-gray-600">{rec.classification}</td>
                      <td className="px-4 py-2.5"><FinalizedBadge /></td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                          className="font-sans text-xs font-medium text-charcoal hover:underline"
                        >
                          {expandedId === rec.id ? 'Hide details' : 'View details'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === rec.id && (
                      <tr className="bg-paper/60">
                        <td colSpan={5} className="px-4 py-3">
                          <RecordDetail record={rec} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-6 pb-6 font-sans text-sm text-gray-400">No previous assessments on record.</p>
        )}

        <Pagination total={history.length} page={currentHistoryPage} pageSize={PAGE_SIZE} onPageChange={setHistoryPage} />

        {previous.length === 0 && history.length > 0 && (
          <p className="px-6 pb-6 font-sans text-xs text-gray-400">
            Only the latest assessment is on record for this learner.
          </p>
        )}
      </section>

      {/* 3. ASSESSMENT ACTIONS */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-charcoal" aria-hidden />
          <h2 className="font-display text-base font-bold text-charcoal">Assessment Actions</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/teacher/assessments/new/${profile.record.id}`)}
            className="h-11 px-5 rounded-xl bg-sprout-500 hover:opacity-95 text-white font-sans text-sm font-semibold inline-flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" aria-hidden /> Start / assign new formal assessment
          </button>
          <button
            type="button"
            onClick={() => navigate('/teacher/assessments')}
            className="h-11 px-4 rounded-xl bg-paper border border-gray-200 hover:bg-gray-50 text-charcoal font-sans text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <ClipboardList className="w-4 h-4" aria-hidden /> View all assessments
          </button>
        </div>
        <p className="font-sans text-xs text-gray-400">
          Finalized formal records are read-only and cannot be edited from here. Use “View details”
          above to inspect a record’s evidence.
        </p>
      </section>
    </div>
  )
}

export default FormalAssessment
