import { memo, useState } from 'react'
import { Utensils, X } from 'lucide-react'
import { formatCategoryLabel, getItemImageUrl } from '../../api/inventory.js'
import { PREFERENCE_TONES } from './preferenceTones.js'

/** An item already saved in a list, with a red X that removes it instantly. */
function PreferenceItemChip({ item, tone, removing, onRemove }) {
  const [imgFailed, setImgFailed] = useState(false)
  const imageUrl = !imgFailed ? getItemImageUrl(item, 'small') : null

  return (
    <div
      data-testid={`preference-item-${item.id}`}
      className={`flex items-center gap-2.5 rounded-xl border p-2 ${PREFERENCE_TONES[tone].chip} ${
        removing ? 'opacity-50' : ''
      }`}
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
        <p className="m-0 truncate text-[11px] text-[#7a8075]">
          {formatCategoryLabel(item.subcategory)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(item)}
        disabled={removing}
        aria-label={`Remove ${item.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#b42318] transition-colors hover:bg-[#fdecea] disabled:cursor-not-allowed"
      >
        <X className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  )
}

export default memo(PreferenceItemChip)