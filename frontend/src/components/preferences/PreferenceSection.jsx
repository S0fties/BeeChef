import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { PREFERENCE_TONES } from './preferenceTones.js'

/** Collapsible section (dropdown) with an "Add ..." button inside. */
function PreferenceSection({ tone, count, onAdd, children }) {
  const [open, setOpen] = useState(false)
  const t = PREFERENCE_TONES[tone]
  const Icon = t.icon
  const panelId = `preference-panel-${tone}`

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e6ebe1] bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f7f9f4]"
      >
        <ChevronRight
          aria-hidden="true"
          className={`h-5 w-5 shrink-0 text-[#36583b] transition-transform duration-150 ${
            open ? 'rotate-90' : ''
          }`}
        />
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.iconBox}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-[#253b2d]">{t.title}</span>
          <span className="block truncate text-xs text-[#7a8075]">{t.description}</span>
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.badge}`}>
          {count}
        </span>
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-[#eef1ea] px-4 py-4">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#36583b] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2a462e]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.addLabel}
          </button>
          {children}
        </div>
      )}
    </section>
  )
}

export default PreferenceSection