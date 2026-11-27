import { memo, useState } from 'react'
import { Check, Utensils } from 'lucide-react'
import { getItemImageUrl } from '../../api/inventory.js'
import { PREFERENCE_TONES } from './preferenceTones.js'

/** Selectable ingredient tile used in the "add" picker. */
function PreferencePickerTile({ item, tone, selected, locked, disabled, note, onToggle }) {
  const [imgFailed, setImgFailed] = useState(false)
  const imageUrl = !imgFailed ? getItemImageUrl(item, 'small') : null
  const t = PREFERENCE_TONES[tone]
  const inactive = locked || disabled
  const active = selected || locked

  return (
    <button
      type="button"
      data-testid={`picker-tile-${item.id}`}
      role="checkbox"
      aria-checked={active}
      aria-label={item.name}
      disabled={inactive}
      onClick={() => onToggle(item)}
      className={`flex w-full items-center gap-2.5 rounded-xl border p-2 text-left transition-colors ${
        active ? t.tileSelected : 'border-[#ebeee7] bg-white hover:border-[#cfd8c8]'
      } ${inactive ? 'cursor-not-allowed' : ''} ${disabled && !locked ? 'opacity-50' : ''}`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eef1ea] bg-white">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            onError={() => setImgFailed(true)}
            className="h-9 w-9 object-contain"
            loading="lazy"
          />
        ) : (
          <Utensils className="h-5 w-5 text-[#5f7a61]" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-semibold text-[#253b2d]" title={item.name}>
          {item.name}
        </p>
        {note && <p className="m-0 truncate text-[11px] text-[#7a8075]">{note}</p>}
      </div>

      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
          active ? t.check : 'border-[#d8dfd2] bg-white text-transparent'
        }`}
      >
        <Check className="h-4 w-4" />
      </span>
    </button>
  )
}

export default memo(PreferencePickerTile)