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
import { formatCategoryLabel, getItemImageUrl } from '../../api/inventory.js'
import { getQuantityStep } from '../../utils/inventoryEditor.js'

function InventoryItemCard({ entry, onEdit, onDelete, onQuickUpdate, groupBy = 'category' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const item = entry.item || {}
  const isAppliance = item.item_type === 'appliance'
  const hasQuantity = !isAppliance && entry.quantity !== null && entry.quantity !== undefined
  const imageUrl = !imgFailed ? getItemImageUrl(item, 'small') : null

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
      className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 shadow-2xs transition-all duration-150 hover:shadow-sm ${
        entry.is_available
          ? 'border-[#e4e8de] bg-white'
          : 'border-[#f1dad6] bg-[#fffcfb]'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eef1ea] bg-[#f7f9f4]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={item.name}
              onError={() => setImgFailed(true)}
              className="h-9 w-9 object-contain"
              loading="lazy"
            />
          ) : isAppliance ? (
            <CookingPot className="h-5 w-5 text-[#36583b]" aria-hidden="true" />
          ) : (
            <Utensils className="h-5 w-5 text-[#5f7a61]" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-sm font-bold text-[#253b2d]" title={item.name}>
            {item.name}
          </h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#697065]">
            {groupBy === 'location' ? (
              <span>{formatCategoryLabel(item.category)}</span>
            ) : entry.location ? (
              <span className="inline-flex items-center gap-1 font-medium capitalize text-[#4a5448]">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                {entry.location}
              </span>
            ) : (
              item.subcategory && <span>{formatCategoryLabel(item.subcategory)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {hasQuantity ? (
          <div className="flex items-center gap-1 rounded-lg border border-[#e2e8dc] bg-[#f8faf6] px-1 py-0.5">
            <button
              type="button"
              onClick={() => handleStepQuantity(-1)}
              aria-label={`Decrease ${item.name} quantity`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#36583b] transition-colors hover:bg-[#edf2e8]"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-[54px] text-center text-xs font-bold text-[#253b2d]">
              {entry.quantity} {entry.unit || item.default_unit || ''}
            </span>
            <button
              type="button"
              onClick={() => handleStepQuantity(1)}
              aria-label={`Increase ${item.name} quantity`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#36583b] transition-colors hover:bg-[#edf2e8]"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleToggleAvailability}
            aria-label={`Toggle ${item.name} availability`}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              entry.is_available
                ? 'bg-[#e7f4ea] text-[#266838] hover:bg-[#d7ecd9]'
                : 'bg-[#fce8e6] text-[#a52a2a] hover:bg-[#f8d7d4]'
            }`}
          >
            {entry.is_available ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span>Available</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                <span>Out of Stock</span>
              </>
            )}
          </button>
        )}

        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            aria-label={`Edit ${item.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5d6659] transition-colors hover:bg-[#edf2e8] hover:text-[#253b2d]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(entry)}
            aria-label={`Delete ${item.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7a5b5b] transition-colors hover:bg-[#fce8e6] hover:text-[#b42318]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

export default InventoryItemCard

