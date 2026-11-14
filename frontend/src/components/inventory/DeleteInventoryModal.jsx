import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

function DeleteInventoryModal({ entry, onClose, onConfirmDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  if (!entry) return null

  const itemName = entry.item?.name || 'this item'

  const handleConfirm = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirmDelete(entry.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete item')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-inventory-modal-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fce8e6] text-[#b42318]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delete modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#697065] hover:bg-[#f2f4ee]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2
          id="delete-inventory-modal-title"
          className="m-0 mt-3 text-lg font-bold text-[#253b2d]"
        >
          Remove {itemName}?
        </h2>
        <p className="m-0 mt-1.5 text-sm text-[#5f685c]">
          Are you sure you want to remove <strong>{itemName}</strong> from your
          household inventory?
        </p>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-[#f5c2c0] bg-[#fdf2f2] px-3 py-2 text-xs font-medium text-[#b42318]"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d8dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#4c584e] hover:bg-[#f4f6f1]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleConfirm}
            className="rounded-xl bg-[#b42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#912018] disabled:opacity-50"
          >
            {deleting ? 'Removing...' : 'Delete Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteInventoryModal

