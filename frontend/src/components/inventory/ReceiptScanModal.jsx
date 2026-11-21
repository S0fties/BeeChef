import { useEffect, useMemo, useState } from 'react'
import { Loader2, Receipt, RotateCcw, Trash2, Upload, X } from 'lucide-react'
import { COMMON_UNITS, STORAGE_LOCATIONS, fetchCatalogItems } from '../../api/inventory.js'
import {
  confirmReceipt,
  discardReceipt,
  scanReceipt,
  uploadReceipt,
  validateReceiptFile,
} from '../../api/receipts.js'

const fieldClass =
  'w-full rounded-lg border border-[#d8dfd2] bg-[#fafbf8] px-2.5 py-1.5 text-sm text-[#253b2d] focus:border-[#36583b] focus:outline-none disabled:opacity-60'
const primaryButton =
  'inline-flex items-center gap-2 rounded-xl bg-[#36583b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2a462e] disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButton =
  'rounded-xl border border-[#d8dfd2] bg-white px-4 py-2.5 text-sm font-semibold text-[#36583b] hover:bg-[#f2f5ee] disabled:opacity-50'

const CATALOG_LIST_ID = 'receipt-catalog-items'
const COUNT_UNITS = new Set(['piece', 'pack'])
const BUSY_LABELS = {
  uploading: 'Uploading…',
  scanning: 'Reading receipt…',
  saving: 'Adding items…',
}

// Same idea as the backend's name_key: case-, spacing- and plural-insensitive.
function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && /(oes|ches|shes|xes)$/.test(word)) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function nameKey(text) {
  return text.toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean).map(singular).join(' ')
}

function toRow(candidate) {
  const matched = candidate.matched_item_id != null
  return {
    key: candidate.candidate_id,
    rawText: candidate.raw_text,
    extractedName: candidate.extracted_name,
    itemId: candidate.matched_item_id,
    itemText: matched ? candidate.matched_item_name : '',
    quantity: candidate.quantity ?? '',
    unit: candidate.unit ?? '',
    location: '',
    // Only catalog items can be added: unmatched lines start unticked and stay locked
    // until the user links them to a catalog item.
    selected: matched,
    discarded: false,
  }
}

function ReceiptScanModal({ onClose, onItemsAdded }) {
  // select | uploading | scanning | review | saving | done
  const [stage, setStage] = useState('select')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [receiptId, setReceiptId] = useState(null)
  const [rows, setRows] = useState([])
  const [catalog, setCatalog] = useState([])
  const [error, setError] = useState('')
  const [addedCount, setAddedCount] = useState(0)

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  // The catalog powers the "link to catalog item" picker for each receipt line.
  // Receipts only add groceries, so the picker offers ingredients only (no appliances).
  useEffect(() => {
    let active = true
    fetchCatalogItems({ limit: 1000, item_type: 'ingredient' })
      .then((items) => {
        if (!active) return
        const list = Array.isArray(items) ? items : []
        setCatalog(list.filter((item) => item.item_type === 'ingredient'))
      })
      .catch(() => {
        if (active) setCatalog([])
      })
    return () => {
      active = false
    }
  }, [])

  // One entry per name key; the original (lowest id) item wins over duplicates like "Bananas".
  const catalogByKey = useMemo(() => {
    const map = new Map()
    ;[...catalog]
      .sort((a, b) => a.id - b.id)
      .forEach((item) => {
        const key = nameKey(item.name)
        if (!map.has(key)) map.set(key, item)
      })
    return map
  }, [catalog])
  const pickerItems = useMemo(() => [...catalogByKey.values()], [catalogByKey])

  const busy = stage in BUSY_LABELS
  const chosen = rows.filter((row) => row.selected && !row.discarded && row.itemId != null)

  const updateRow = (key, patch) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  // The row links to a catalog item only when the text matches one (singular/plural-insensitive).
  // Without a link the row cannot be added.
  const handleItemTextChange = (row, text) => {
    const item = catalogByKey.get(nameKey(text))
    const patch = { itemText: text, itemId: item ? item.id : null, selected: Boolean(item) }
    if (item) {
      // Only counted units are safe to assume; a bare "1" must never become "1 ml" or "1 g".
      if (row.quantity !== '' && !row.unit && COUNT_UNITS.has(item.default_unit)) {
        patch.unit = item.default_unit
      }
    }
    updateRow(row.key, patch)
  }

  // Delete the stored receipt on the server. If this fails (e.g. offline),
  // the server's automatic cleanup removes it later.
  const forgetReceipt = () => {
    if (receiptId) discardReceipt(receiptId).catch(() => {})
    setReceiptId(null)
  }

  // Step 1 + E1 (client side)
  const handleFileChange = (event) => {
    const picked = event.target.files?.[0]
    if (!picked) return
    forgetReceipt() // a new photo replaces any previously stored one
    const problem = validateReceiptFile(picked)
    if (problem) {
      setError(problem)
      setFile(null)
      setPreviewUrl('')
      return
    }
    setError('')
    setFile(picked)
    setPreviewUrl(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(picked) : '')
  }

  // Steps 1-4 + E1/E2 (server side)
  const handleScan = async () => {
    setError('')
    let id = receiptId
    try {
      if (!id) {
        setStage('uploading')
        id = (await uploadReceipt(file)).receipt_id
        setReceiptId(id)
      }
      setStage('scanning')
      const data = await scanReceipt(id)
      setRows(data.candidates.map(toRow))
      setStage('review')
    } catch (err) {
      // 400/404/413: the server no longer has this receipt, so the next try uploads again.
      // 502/503 or a network error: the stored copy is kept, so the next try only re-scans.
      if ([400, 404, 413].includes(err.status)) setReceiptId(null)
      setError(err.message || 'The receipt could not be processed.')
      setStage('select')
    }
  }

  const resetToSelect = () => {
    forgetReceipt()
    setRows([])
    setFile(null)
    setPreviewUrl('')
    setError('')
    setStage('select')
  }

  // Step 6 + A1/A2/E3
  const handleConfirm = async () => {
    if (chosen.length === 0) {
      // A2: nothing to add; inventory untouched, receipt deleted
      forgetReceipt()
      setAddedCount(0)
      setStage('done')
      return
    }
    const badQuantity = chosen.find((row) => row.quantity !== '' && !(Number(row.quantity) > 0))
    if (badQuantity) {
      setError(`Check "${badQuantity.itemText}": quantity must be greater than 0.`)
      return
    }
    const missingUnit = chosen.find((row) => row.quantity !== '' && !row.unit)
    if (missingUnit) {
      setError(`Choose a unit for the amount of "${missingUnit.itemText}".`)
      return
    }
    setStage('saving')
    setError('')
    try {
      const result = await confirmReceipt(
        receiptId,
        chosen.map((row) => ({
          item_id: row.itemId,
          quantity: row.quantity === '' ? null : Number(row.quantity),
          unit: row.quantity === '' ? null : row.unit || null,
          location: row.location || null,
        })),
      )
      setReceiptId(null) // the server already deleted it
      setAddedCount(result.added_count)
      setStage('done')
      onItemsAdded?.(result)
    } catch (err) {
      // E3: nothing was added; the receipt and the user's edits are kept for a retry
      setError(`Inventory was not updated: ${err.message}`)
      setStage('review')
    }
  }

  const handleClose = () => {
    if (stage !== 'done') forgetReceipt()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[#e6ebe1] px-5 py-4">
          <h2
            id="receipt-modal-title"
            className="m-0 flex items-center gap-2 text-lg font-bold text-[#253b2d]"
          >
            <Receipt className="h-5 w-5" /> Receipt scanner
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#5d6659] hover:bg-[#f2f5ee] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm font-medium text-[#b42318]"
            >
              {error}
            </div>
          )}

          {(stage === 'select' || stage === 'uploading' || stage === 'scanning') && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[#cfd8c8] bg-[#fafbf8] px-4 py-8 text-center text-sm text-[#5d6659]">
                <Upload className="h-6 w-6 text-[#36583b]" />
                <span>
                  {file ? file.name : 'Choose a receipt photo (JPEG, PNG or WebP, up to 10 MB)'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label="Receipt image"
                  onChange={handleFileChange}
                  disabled={busy}
                />
              </label>
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Selected receipt"
                  className="mx-auto max-h-64 rounded-lg object-contain"
                />
              )}
            </div>
          )}

          {(stage === 'review' || stage === 'saving') &&
            (rows.length === 0 ? (
              <p className="m-0 text-sm text-[#5d6659]">No items were found on this receipt.</p>
            ) : (
              <>
                <p className="m-0 text-xs text-[#697065]">
                  Only items from your catalog can be added. Lines that don&apos;t match the
                  catalog are skipped unless you link them to a catalog item. Check the matches,
                  fix amounts or units, and untick or discard anything you don&apos;t want to add.
                </p>
                <datalist id={CATALOG_LIST_ID}>
                  {pickerItems.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
                <ul className="m-0 list-none space-y-3 p-0">
                  {rows.map((row) => {
                    const linked = row.itemId != null
                    const disabled = row.discarded || busy
                    return (
                      <li
                        key={row.key}
                        className={`rounded-xl border p-3 ${
                          row.discarded
                            ? 'border-dashed border-[#e0e4dc] opacity-50'
                            : linked
                              ? 'border-[#e6ebe1]'
                              : 'border-[#f0d9a8]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-2 h-4 w-4 accent-[#36583b]"
                            aria-label={`Add ${row.rawText}`}
                            checked={row.selected && !row.discarded && linked}
                            disabled={disabled || !linked}
                            onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                          />
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="m-0 truncate text-xs text-[#7a8075]" title={row.rawText}>
                                Receipt: {row.rawText}
                              </p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  linked
                                    ? 'bg-[#edf2e8] text-[#36583b]'
                                    : 'bg-[#fdf1d8] text-[#8a5a00]'
                                }`}
                              >
                                {linked ? 'In catalog' : 'Not in catalog'}
                              </span>
                            </div>
                            <input
                              className={fieldClass}
                              list={CATALOG_LIST_ID}
                              placeholder="Search the catalog…"
                              aria-label={`Catalog item for ${row.rawText}`}
                              value={row.itemText}
                              disabled={disabled}
                              onChange={(e) => handleItemTextChange(row, e.target.value)}
                            />
                            {!linked && (
                              <p className="m-0 text-xs text-[#8a5a00]">
                                {row.extractedName ? `Read as "${row.extractedName}". ` : ''}
                                No matching catalog item, so this line won&apos;t be added. Pick a
                                catalog item above if it should be.
                              </p>
                            )}
                            <div className="grid grid-cols-3 gap-2">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="Qty"
                                className={fieldClass}
                                aria-label={`Quantity for ${row.rawText}`}
                                value={row.quantity}
                                disabled={disabled}
                                onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                              />
                              <select
                                className={fieldClass}
                                aria-label={`Unit for ${row.rawText}`}
                                value={row.unit}
                                disabled={disabled}
                                onChange={(e) => updateRow(row.key, { unit: e.target.value })}
                              >
                                <option value="">Unit</option>
                                {COMMON_UNITS.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {unit}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={fieldClass}
                                aria-label={`Location for ${row.rawText}`}
                                value={row.location}
                                disabled={disabled}
                                onChange={(e) => updateRow(row.key, { location: e.target.value })}
                              >
                                <option value="">Location</option>
                                {STORAGE_LOCATIONS.map((loc) => (
                                  <option key={loc.value} value={loc.value}>
                                    {loc.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={row.discarded ? `Restore ${row.rawText}` : `Discard ${row.rawText}`}
                            onClick={() =>
                              updateRow(
                                row.key,
                                row.discarded
                                  ? { discarded: false, selected: row.itemId != null }
                                  : { discarded: true },
                              )
                            }
                            className="rounded-lg p-1.5 text-[#7a8075] hover:bg-[#f2f5ee]"
                          >
                            {row.discarded ? (
                              <RotateCcw className="h-4 w-4" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            ))}

          {stage === 'done' && (
            <div
              role="status"
              className="rounded-xl border border-[#dce4d5] bg-[#f4f7f0] px-4 py-3 text-sm font-medium text-[#253b2d]"
            >
              {addedCount > 0
                ? `Added ${addedCount} item${addedCount === 1 ? '' : 's'} to your inventory.`
                : 'No items were added. Your inventory is unchanged.'}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2.5 border-t border-[#e6ebe1] px-5 py-4">
          {stage === 'select' && (
            <>
              <button type="button" className={secondaryButton} onClick={handleClose}>
                Cancel
              </button>
              <button type="button" className={primaryButton} onClick={handleScan} disabled={!file}>
                {receiptId ? 'Try again' : 'Scan Receipt'}
              </button>
            </>
          )}
          {busy && (
            <button type="button" className={primaryButton} disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              {BUSY_LABELS[stage]}
            </button>
          )}
          {stage === 'review' && (
            <>
              <button type="button" className={secondaryButton} onClick={resetToSelect}>
                Scan another
              </button>
              <button type="button" className={primaryButton} onClick={handleConfirm}>
                {chosen.length === 0
                  ? 'Finish without adding'
                  : `Add ${chosen.length} item${chosen.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
          {stage === 'done' && (
            <button type="button" className={primaryButton} onClick={onClose}>
              Close
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default ReceiptScanModal
