import { SECTIONS } from './sectionData'

interface SectionSelectorProps {
  value: string
  onChange: (sectionId: string) => void
}

/** Dropdown that lets the teacher pick which section the dashboard shows. */
function SectionSelector({ value, onChange }: SectionSelectorProps) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="font-sans text-sm text-gray-500">Section</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-sans text-sm font-semibold text-charcoal bg-white border border-gray-200 rounded-xl px-3 py-2 pr-8 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-sprout-500/40 transition-colors"
        aria-label="Select section"
      >
        {SECTIONS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default SectionSelector
