import { useState } from 'react'
import {
  CheckCircle2,
  CookingPot,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Utensils,
  XCircle,
} from 'lucide-react'
import { formatCategoryLabel, getMealDbImageUrl } from '../../api/inventory.js'
import { getQuantityStep } from '../../utils/inventoryEditor.js'

function InventoryItemCard({ entry, onEdit, onDelete, onQuickUpdate }) {
  const [imgFailed, setImgFailed] = useState(false)
  const item = entry.item || {}
  const isAppliance = item.item_type === 'appliance'
  const hasQuantity = !isAppliance && entry.quantity !== null && entry.quantity !== undefined
  const imageUrl = !isAppliance && !imgFailed ? getMealDbImageUrl(item.name, 'small') : null

  const handleStepQuantity = (delta) => {
    if (!onQuickUpdate || !hasQuantity) return
    const step = getQuantityStep(entry.unit)
    const nextQty = Math.max(0, Number((entry.quantity + delta * step).toFixed(2)))
    onQuickUpdate(entry, {
      quantity: nextQty,
      is_available: nextQty > 0,
    })
  }

  const handleToggleAvailability = () => {
    if (!onQuickUpdate) return
    onQuickUpdate(entry, {
      is_available: !entry.is_available,
    })
  }

  return (
    <article
      data-testid={`inventory-card-${entry.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-xs transition-all duration-150 hover:shadow-md ${
        entry.is_available ? 'border-[#e4e8de]' : 'border-[#f1dad6] bg-[#fffcfb]'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#eef1ea] bg-[#f7f9f4]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              onError={() => setImgFailed(true)}
              className="h-12 w-12 object-contain"
              loading="lazy"
            />
          ) : isAppliance ? (
            <CookingPot className="h-6 w-6 text-[#36583b]" aria-hidden="true" />
          ) : (
            <Utensils className="h-6 w-6 text-[#5f7a61]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="m-0 truncate text-base font-semibold text-[#253b2d]">
              {item.name}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isAppliance
                  ? 'bg-[#e8eff7] text-[#2c527a]'
                  : 'bg-[#edf2e8] text-[#36583b]'
              }`}
            >
              {isAppliance ? 'Appliance' : 'Ingredient'}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#697065]">
            <span>{formatCategoryLabel(item.category)}</span>
            {entry.location && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-[#f4f5f0] px-2 py-0.5 font-medium capitalize text-[#4a5448]">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {entry.location}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-[#f1f2ec] pt-3">
        {hasQuantity ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStepQuantity(-1)}
              aria-label={`Decrease ${item.name} quantity`}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dce2d5] bg-[#f8faf6] text-[#36583b] transition-colors hover:bg-[#edf2e8]"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-[68px] text-center text-sm font-bold text-[#253b2d]">
              {entry.quantity} {entry.unit || item.default_unit || ''}
            </span>
            <button
              type="button"
              onClick={() => handleStepQuantity(1)}
              aria-label={`Increase ${item.name} quantity`}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dce2d5] bg-[#f8faf6] text-[#36583b] transition-colors hover:bg-[#edf2e8]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleToggleAvailability}
            aria-label={`Toggle ${item.name} availability`}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              entry.is_available
                ? 'bg-[#e7f4ea] text-[#266838] hover:bg-[#d7ecd9]'
                : 'bg-[#fce8e6] text-[#a52a2a] hover:bg-[#f8d7d4]'
            }`}
          >
            {entry.is_available ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Available</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5" />
                <span>Out of Stock</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            aria-label={`Edit ${item.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5d6659] transition-colors hover:bg-[#edf2e8] hover:text-[#253b2d]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`Delete ${item.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7a5b5b] transition-colors hover:bg-[#fce8e6] hover:text-[#b42318]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default InventoryItemCard

