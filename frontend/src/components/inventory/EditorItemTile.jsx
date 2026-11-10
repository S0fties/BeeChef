import { memo, useState } from 'react'
import { Check, CookingPot, Minus, Plus, Utensils } from 'lucide-react'
import { getMealDbImageUrl } from '../../api/inventory.js'

function EditorItemTile({ item, unit, state, changed, onIncrement, onDecrement, onSetQuantity }) {
  const [imgFailed, setImgFailed] = useState(false)
  const isAppliance = item.item_type === 'appliance'
  const inStock = Boolean(state.is_available)
  const hasQuantity = state.quantity !== null && state.quantity !== undefined
  const imageUrl = !isAppliance && !imgFailed ? getMealDbImageUrl(item.name, 'small') : null

  return (
    <div
      data-testid={`editor-tile-${item.id}`}
      className={`flex items-center gap-2.5 rounded-xl border p-2 transition-colors ${
        changed
          ? 'border-[#e0b44a] bg-[#fffaf0]'
          : inStock
            ? 'border-[#cfe0c9] bg-[#f6faf3]'
            : 'border-[#ebeee7] bg-white'
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
        ) : isAppliance ? (
          <CookingPot className="h-5 w-5 text-[#36583b]" aria-hidden="true" />
        ) : (
          <Utensils className="h-5 w-5 text-[#5f7a61]" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-sm font-semibold text-[#253b2d]" title={item.name}>
          {item.name}
        </p>
        <p className="m-0 text-[11px] text-[#7a8075]">
          {isAppliance ? 'Appliance' : unit}
        </p>
      </div>

      {isAppliance ? (
        <button
          type="button"
          role="switch"
          aria-checked={inStock}
          aria-label={`Toggle ${item.name}`}
          onClick={() => (inStock ? onDecrement(item) : onIncrement(item))}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            inStock
              ? 'border-[#36583b] bg-[#36583b] text-white'
              : 'border-[#d8dfd2] bg-white text-transparent hover:border-[#36583b]'
          }`}
        >
          <Check className="h-4 w-4" />
        </button>
      ) : (
        <div className="flex shrink-0 flex-col items-center">
          <button
            type="button"
            onClick={() => onIncrement(item)}
            aria-label={`Increase ${item.name}`}
            className="flex h-6 w-8 items-center justify-center rounded-md text-[#b42318] hover:bg-[#fdecea]"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
          </button>
          {hasQuantity || !inStock ? (
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              aria-label={`${item.name} quantity`}
              value={hasQuantity ? state.quantity : 0}
              onChange={(e) => onSetQuantity(item, e.target.value)}
              onFocus={(e) => e.target.select()}
              className="w-14 [appearance:textfield] rounded-md border border-transparent bg-transparent text-center text-sm font-bold text-[#253b2d] hover:border-[#d8dfd2] focus:border-[#36583b] focus:bg-white focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <span
              aria-label={`${item.name} quantity`}
              className="w-14 text-center text-xs font-bold text-[#266838]"
            >
              In stock
            </span>
          )}
          <button
            type="button"
            onClick={() => onDecrement(item)}
            aria-label={`Decrease ${item.name}`}
            disabled={!inStock && !(state.quantity > 0)}
            className="flex h-6 w-8 items-center justify-center rounded-md text-[#b42318] hover:bg-[#fdecea] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Minus className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(EditorItemTile)
