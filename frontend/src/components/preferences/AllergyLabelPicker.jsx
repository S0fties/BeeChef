import { ALLERGY_LABELS } from '../../api/preferences.js'

/** Toggleable allergy labels. Selected = red border. Each click is saved instantly by the parent. */
function AllergyLabelPicker({ selected, pending, onToggle }) {
  return (
    <div>
      <p className="m-0 mb-2 text-xs font-semibold text-[#697065]">Common allergies</p>
      <div className="flex flex-wrap gap-2">
        {ALLERGY_LABELS.map(({ value, label }) => {
          const isSelected = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              disabled={pending.has(`label:${value}`)}
              onClick={() => onToggle(value, isSelected)}
              className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
                isSelected
                  ? 'border-[#d92d20] bg-[#fdf2f2] text-[#b42318]'
                  : 'border-[#e2e8dc] bg-white text-[#4c584e] hover:border-[#cfd8c8]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default AllergyLabelPicker