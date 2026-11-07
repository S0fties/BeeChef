import { useEffect, useState } from 'react'
import { CookingPot, Plus, Search, Utensils, X } from 'lucide-react'
import {
  CATALOG_CATEGORIES,
  COMMON_UNITS,
  STORAGE_LOCATIONS,
  createCatalogItem,
  fetchCatalogItems,
  formatCategoryLabel,
  getMealDbImageUrl,
} from '../../api/inventory.js'

function AddInventoryModal({ isOpen, onClose, onAddEntry, existingItemIds = [] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [catalogItems, setCatalogItems] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)

  // Stock tracking state
  const [trackByQuantity, setTrackByQuantity] = useState(true)
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('piece')
  const [location, setLocation] = useState('fridge')
  const [isAvailable, setIsAvailable] = useState(true)

  // Custom catalog item creation state
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customType, setCustomType] = useState('ingredient')
  const [customCategory, setCustomCategory] = useState('VEGETABLE')
  const [customDefaultUnit, setCustomDefaultUnit] = useState('g')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    async function loadCatalog() {
      try {
        const items = await fetchCatalogItems({
          search: searchQuery.trim() || undefined,
          limit: 60,
        })
        if (!cancelled) {
          setCatalogItems(Array.isArray(items) ? items : [])
          setLoadingCatalog(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load catalog items')
          setLoadingCatalog(false)
        }
      }
    }

    loadCatalog()
    return () => {
      cancelled = true
    }
  }, [isOpen, searchQuery])

  if (!isOpen) return null

  const handleSelectCatalogItem = (item) => {
    setSelectedItem(item)
    setError('')
    if (item.item_type === 'appliance') {
      setTrackByQuantity(false)
      setLocation('counter')
    } else {
      setTrackByQuantity(true)
      setUnit(item.default_unit || 'piece')
      setQuantity(item.default_unit === 'g' || item.default_unit === 'ml' ? '500' : '1')
    }
  }

  const handleCreateCustomCatalogItem = async (e) => {
    e.preventDefault()
    if (!customName.trim()) {
      setError('Please enter a name for the custom item.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const catMeta =
        CATALOG_CATEGORIES.find((c) => c.value === customCategory) || CATALOG_CATEGORIES[0]
      const created = await createCatalogItem({
        name: customName.trim(),
        item_type: customType,
        category: customCategory,
        subcategory: catMeta.defaultSubcategory,
        default_unit: customType === 'appliance' ? null : customDefaultUnit,
      })
      setCatalogItems((prev) => [created, ...prev])
      handleSelectCatalogItem(created)
      setShowCustomForm(false)
      setCustomName('')
    } catch (err) {
      setError(err.message || 'Failed to create custom item')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedItem) {
      setError('Please select an item from the catalog first.')
      return
    }

    const isAppliance = selectedItem.item_type === 'appliance'
    const parsedQuantity =
      !isAppliance && trackByQuantity ? Number(quantity) : null

    if (!isAppliance && trackByQuantity && (Number.isNaN(parsedQuantity) || parsedQuantity < 0)) {
      setError('Please enter a valid non-negative quantity.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onAddEntry({
        item_id: selectedItem.id,
        is_available:
          !isAppliance && trackByQuantity ? parsedQuantity > 0 : isAvailable,
        quantity: parsedQuantity,
        unit: !isAppliance && trackByQuantity ? unit : null,
        location: location || null,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to add item to inventory')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-inventory-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#eeece4] pb-4">
          <div>
            <h2
              id="add-inventory-modal-title"
              className="m-0 text-xl font-bold text-[#253b2d]"
            >
              Add Item to Inventory
            </h2>
            <p className="m-0 mt-0.5 text-xs text-[#697065]">
              Pick an ingredient or kitchen appliance from the BeeChef catalog
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#697065] hover:bg-[#f2f4ee] hover:text-[#253b2d]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-[#f5c2c0] bg-[#fdf2f2] px-3.5 py-2.5 text-xs font-medium text-[#b42318]"
          >
            {error}
          </div>
        )}

        {/* Catalog Search & Selection */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="catalog-search-input"
              className="text-xs font-semibold tracking-wide text-[#425246] uppercase"
            >
              1. Select Catalog Item
            </label>
            <button
              type="button"
              onClick={() => setShowCustomForm((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#36583b] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {showCustomForm ? 'Back to catalog list' : 'Create custom catalog item'}
            </button>
          </div>

          {showCustomForm ? (
            <form
              onSubmit={handleCreateCustomCatalogItem}
              className="mt-2.5 space-y-3 rounded-xl border border-[#dce2d5] bg-[#f8faf6] p-3.5"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="custom-item-name"
                    className="block text-xs font-medium text-[#37473b]"
                  >
                    Item Name
                  </label>
                  <input
                    id="custom-item-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Matcha Powder"
                    className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-1.5 text-sm text-[#253b2d] focus:border-[#36583b] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="custom-item-type"
                    className="block text-xs font-medium text-[#37473b]"
                  >
                    Item Type
                  </label>
                  <select
                    id="custom-item-type"
                    value={customType}
                    onChange={(e) => {
                      const nextType = e.target.value
                      setCustomType(nextType)
                      setCustomCategory(
                        nextType === 'appliance' ? 'COOKING_APPLIANCE' : 'VEGETABLE',
                      )
                    }}
                    className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-1.5 text-sm text-[#253b2d]"
                  >
                    <option value="ingredient">Ingredient</option>
                    <option value="appliance">Appliance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="custom-item-category"
                    className="block text-xs font-medium text-[#37473b]"
                  >
                    Category
                  </label>
                  <select
                    id="custom-item-category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-1.5 text-sm text-[#253b2d]"
                  >
                    {CATALOG_CATEGORIES.filter((c) => c.type === customType).map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {customType === 'ingredient' && (
                  <div>
                    <label
                      htmlFor="custom-item-unit"
                      className="block text-xs font-medium text-[#37473b]"
                    >
                      Default Unit
                    </label>
                    <select
                      id="custom-item-unit"
                      value={customDefaultUnit}
                      onChange={(e) => setCustomDefaultUnit(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#d4ddd0] bg-white px-3 py-1.5 text-sm text-[#253b2d]"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#36583b] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2b472f] disabled:opacity-50"
                >
                  Save & Select Custom Item
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#777a72]" />
                <input
                  id="catalog-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setLoadingCatalog(true)
                    setSearchQuery(e.target.value)
                  }}
                  placeholder="Search 700+ ingredients & appliances (e.g. Tomatoes, Chicken, Air Fryer)..."
                  className="w-full rounded-xl border border-[#d8dfd2] bg-[#fafbf8] py-2 pr-3 pl-9 text-sm text-[#253b2d] placeholder:text-[#8c9187] focus:border-[#36583b] focus:bg-white focus:outline-none"
                />
              </div>

              <div
                className="mt-2.5 max-h-48 overflow-y-auto rounded-xl border border-[#e6ebe1] bg-[#fcfdfa] p-1.5"
                role="listbox"
                aria-label="Catalog items"
              >
                {loadingCatalog ? (
                  <p className="py-6 text-center text-xs text-[#777a72]">
                    Loading catalog items...
                  </p>
                ) : catalogItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#777a72]">
                    No matching catalog items found.
                  </p>
                ) : (
                  catalogItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id
                    const alreadyInInventory = existingItemIds.includes(item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={alreadyInInventory}
                        onClick={() => handleSelectCatalogItem(item)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-[#36583b] text-white'
                            : alreadyInInventory
                              ? 'cursor-not-allowed opacity-50'
                              : 'text-[#253b2d] hover:bg-[#edf2e8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.item_type === 'appliance' ? (
                            <CookingPot className="h-4 w-4 shrink-0" />
                          ) : (
                            <img
                              src={getMealDbImageUrl(item.name, 'small')}
                              alt=""
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                              className="h-6 w-6 shrink-0 object-contain"
                            />
                          )}
                          <span className="font-medium">{item.name}</span>
                          <span
                            className={`text-xs ${
                              isSelected ? 'text-[#d9e5d6]' : 'text-[#777a72]'
                            }`}
                          >
                            ({formatCategoryLabel(item.category)})
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            isSelected ? 'text-white' : 'text-[#5b695d]'
                          }`}
                        >
                          {alreadyInInventory
                            ? 'Already added'
                            : item.default_unit || 'Appliance'}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Stock Details Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="rounded-xl border border-[#e6ebe1] bg-[#f9faf7] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-[#425246] uppercase">
                2. Configure Stock Details
              </span>
              {selectedItem && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#edf2e8] px-2.5 py-0.5 text-xs font-semibold text-[#36583b]">
                  {selectedItem.item_type === 'appliance' ? (
                    <CookingPot className="h-3.5 w-3.5" />
                  ) : (
                    <Utensils className="h-3.5 w-3.5" />
                  )}
                  {selectedItem.name}
                </span>
              )}
            </div>

            {selectedItem?.item_type !== 'appliance' && (
              <div className="mt-3 flex gap-2">
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
                  Quick Available / Out of Stock
                </button>
              </div>
            )}

            {selectedItem?.item_type !== 'appliance' && trackByQuantity ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="add-item-quantity"
                    className="block text-xs font-medium text-[#37473b]"
                  >
                    Quantity
                  </label>
                  <input
                    id="add-item-quantity"
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
                    htmlFor="add-item-unit"
                    className="block text-xs font-medium text-[#37473b]"
                  >
                    Unit
                  </label>
                  <select
                    id="add-item-unit"
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
              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm font-medium text-[#253b2d]">
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#36583b]"
                  />
                  Currently available in household
                </label>
              </div>
            )}

            <div className="mt-3">
              <label
                htmlFor="add-item-location"
                className="block text-xs font-medium text-[#37473b]"
              >
                Storage Location
              </label>
              <select
                id="add-item-location"
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
              disabled={submitting || !selectedItem}
              className="rounded-xl bg-[#36583b] px-5 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#2a462e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddInventoryModal
