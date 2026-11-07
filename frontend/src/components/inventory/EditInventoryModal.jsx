import { useState } from 'react'
import { X } from 'lucide-react'
import { COMMON_UNITS, STORAGE_LOCATIONS } from '../../api/inventory.js'

function EditInventoryModal({ entry, onClose, onSave }) {
  const item = entry?.item || {}
  const isAppliance = item.item_type === 'appliance'
  const initialHasQty =
    !isAppliance && entry?.quantity !== null && entry?.quantity !== undefined

  const [trackByQuantity, setTrackByQuantity] = useState(initialHasQty)
  const [quantity, setQuantity] = useState(
    initialHasQty ? String(entry.quantity) : '1',
  )
  const [unit, setUnit] = useState(entry?.unit || item.default_unit || 'piece')
  const [location, setLocation] = useState(entry?.location || '')
  const [isAvailable, setIsAvailable] = useState(Boolean(entry?.is_available))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!entry) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const parsedQty = !isAppliance && trackByQuantity ? Number(quantity) : null
    if (!isAppliance && trackByQuantity && (Number.isNaN(parsedQty) || parsedQty < 0)) {
      setError('Please enter a valid non-negative quantity.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onSave(entry.id, {
        quantity: parsedQty,
        unit: !isAppliance && trackByQuantity ? unit : null,
        location: location || null,
        is_available:
          !isAppliance && trackByQuantity ? parsedQty > 0 : isAvailable,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to update inventory item')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-inventory-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#eeece4] pb-3.5">
          <div>
            <h2
              id="edit-inventory-modal-title"
              className="m-0 text-lg font-bold text-[#253b2d]"
            >
              Edit {item.name}
            </h2>
            <p className="m-0 mt-0.5 text-xs text-[#697065]">
              Update household stock quantity, availability, or storage location
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#697065] hover:bg-[#f2f4ee] hover:text-[#253b2d]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-[#f5c2c0] bg-[#fdf2f2] px-3 py-2 text-xs font-medium text-[#b42318]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {!isAppliance && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTrackByQuantity(true)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  trackByQuantity
                    ? 'bg-[#36583b] text-white'
                    : 'border border-[#d5ddd0] bg-white text-[#4f5d50]'
                }`}
              >
                Track by Quantity
              </button>
              <button
                type="button"
                onClick={() => setTrackByQuantity(false)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  !trackByQuantity
                    ? 'bg-[#36583b] text-white'
                    : 'border border-[#d5ddd0] bg-white text-[#4f5d50]'
                }`}
              >
                Binary (Available / Out)
              </button>
            </div>
          )}

          {!isAppliance && trackByQuantity ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="edit-item-quantity"
                  className="block text-xs font-medium text-[#37473b]"
                >
                  Quantity
                </label>
                <input
                  id="edit-item-quantity"
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-2 text-sm text-[#253b2d]"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-item-unit"
                  className="block text-xs font-medium text-[#37473b]"
                >
                  Unit
                </label>
                <select
                  id="edit-item-unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-2 text-sm text-[#253b2d]"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-[#253b2d]">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#36583b]"
                />
                Available in household
              </label>
            </div>
          )}

          <div>
            <label
              htmlFor="edit-item-location"
              className="block text-xs font-medium text-[#37473b]"
            >
              Storage Location
            </label>
            <select
              id="edit-item-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-2 text-sm text-[#253b2d]"
            >
              <option value="">No specific location</option>
              {STORAGE_LOCATIONS.map((loc) => (
                <option key={loc.value} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d8dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#4c584e] hover:bg-[#f4f6f1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#36583b] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a462e] disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditInventoryModal
