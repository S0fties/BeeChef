import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2, Plus, Save, Search, X } from 'lucide-react'
import {
  CATALOG_CATEGORIES,
  createCatalogItem,
  fetchCatalogItems,
  formatCategoryLabel,
} from '../../api/inventory.js'
import {
  applyDraft,
  buildInventoryChanges,
  decrementState,
  getEffectiveState,
  getItemUnit,
  groupCatalog,
  incrementState,
  setQuantityState,
} from '../../utils/inventoryEditor.js'
import EditorItemTile from './EditorItemTile.jsx'

const CATEGORY_LABELS = Object.fromEntries(CATALOG_CATEGORIES.map((c) => [c.value, c.label]))

function InventoryEditor({ entries, onCommit, onExit }) {
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [drafts, setDrafts] = useState({})
  // Accordion: only one category can be open at a time
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [customCategory, setCustomCategory] = useState('VEGETABLE')
  const [creatingCustom, setCreatingCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const mainNav = document.querySelector('nav[aria-label="Main navigation"]')
    const navHeader = mainNav?.closest('header') || mainNav
    if (!navHeader) return undefined

    const prevVisibility = navHeader.style.visibility
    const prevPointerEvents = navHeader.style.pointerEvents
    const prevAriaHidden = navHeader.getAttribute('aria-hidden')

    navHeader.style.visibility = 'hidden'
    navHeader.style.pointerEvents = 'none'
    navHeader.setAttribute('aria-hidden', 'true')

    return () => {
      navHeader.style.visibility = prevVisibility
      navHeader.style.pointerEvents = prevPointerEvents
      if (prevAriaHidden === null) {
        navHeader.removeAttribute('aria-hidden')
      } else {
        navHeader.setAttribute('aria-hidden', prevAriaHidden)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCatalogItems({ limit: 1000 })
      .then((items) => {
        if (!cancelled) setCatalog(Array.isArray(items) ? items : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load catalog items')
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const entryByItemId = useMemo(
    () => new Map(entries.map((entry) => [entry.item_id, entry])),
    [entries],
  )

  // Catalog + any inventory item that's not in the fetched catalog page
  const allItems = useMemo(() => {
    const byId = new Map(catalog.map((item) => [item.id, item]))
    entries.forEach((entry) => {
      if (entry.item && !byId.has(entry.item_id)) byId.set(entry.item_id, entry.item)
    })
    return [...byId.values()]
  }, [catalog, entries])

  const catalogById = useMemo(() => new Map(allItems.map((i) => [i.id, i])), [allItems])

  const query = searchQuery.trim().toLowerCase()

  const groups = useMemo(() => {
    const inventoryIds = new Set(entries.filter((e) => e.is_available).map((e) => e.item_id))
    const visible = query
      ? allItems.filter((item) => (item.name || '').toLowerCase().includes(query))
      : allItems
    return groupCatalog(visible, CATALOG_CATEGORIES, inventoryIds)
  }, [allItems, entries, query])

  const changeCount = Object.keys(drafts).length

  const updateItem = useCallback(
    (item, computeNext) => {
      const entry = entryByItemId.get(item.id)
      setDrafts((prev) => {
        const current = getEffectiveState(item, entry, prev[item.id])
        return applyDraft(prev, item, entry, computeNext(item, entry, current))
      })
    },
    [entryByItemId],
  )

  const handleIncrement = useCallback((item) => updateItem(item, incrementState), [updateItem])
  const handleDecrement = useCallback((item) => updateItem(item, decrementState), [updateItem])
  const handleSetQuantity = useCallback(
    (item, value) => updateItem(item, () => setQuantityState(value)),
    [updateItem],
  )

  const toggleCategory = (category) => {
    setExpandedCategory((prev) => (prev === category ? null : category))
  }

  const handleCreateCustom = async () => {
    const name = searchQuery.trim()
    if (!name) return
    setCreatingCustom(true)
    setError('')
    try {
      const meta = CATALOG_CATEGORIES.find((c) => c.value === customCategory) || CATALOG_CATEGORIES[0]
      const created = await createCatalogItem({
        name,
        item_type: meta.type,
        category: meta.value,
        subcategory: meta.defaultSubcategory,
        default_unit: meta.type === 'appliance' ? null : 'piece',
      })
      setCatalog((prev) => [...prev, created])
      handleIncrement(created)
    } catch (err) {
      setError(err.message || 'Failed to create custom item')
    } finally {
      setCreatingCustom(false)
    }
  }

  const handleSave = async () => {
    if (changeCount === 0) {
      onExit()
      return
    }
    setSaving(true)
    setError('')
    try {
      const changes = buildInventoryChanges(entries, drafts, catalogById)
      await onCommit(changes)
      setDrafts({})
      onExit()
    } catch (err) {
      setError(err.message || 'Some changes could not be saved')
    } finally {
      setSaving(false)
    }
  }

  const exactMatch = query && allItems.some((item) => (item.name || '').toLowerCase() === query)

  return (
    <div className="space-y-3 pb-24">
      {/* Search */}
      <div className="rounded-2xl border border-[#e6ebe1] bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#777a72]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search catalog"
            placeholder="Search ingredients & appliances..."
            className="w-full rounded-xl border border-[#d8dfd2] bg-[#fafbf8] py-2 pr-9 pl-9 text-sm text-[#253b2d] placeholder:text-[#8c9187] focus:border-[#36583b] focus:bg-white focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#777a72] hover:bg-[#f2f4ee]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {query && !exactMatch && !loadingCatalog && (
          <div className="mt-2.5 flex flex-col gap-2 rounded-xl border border-dashed border-[#cfd8c8] bg-[#f8faf6] p-2.5 text-xs text-[#4f5d50] sm:flex-row sm:items-center">
            <span className="flex-1">
              Can&apos;t find it? Add <strong>&quot;{searchQuery.trim()}&quot;</strong> as a custom item in
            </span>
            <select
              aria-label="Custom item category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className="rounded-lg border border-[#d4ddd0] bg-white px-2 py-1 text-xs text-[#253b2d]"
            >
              {CATALOG_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateCustom}
              disabled={creatingCustom}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#36583b] px-3 py-1.5 font-semibold text-white hover:bg-[#2a462e] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add custom item
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm font-medium text-[#b42318]"
        >
          {error}
        </div>
      )}

      {/* Category accordion */}
      {loadingCatalog ? (
        <div
          role="status"
          className="rounded-2xl border border-[#e6ebe1] bg-white py-14 text-center text-sm text-[#697065]"
        >
          Loading catalog...
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#cfd8c8] bg-white py-10 text-center text-sm text-[#697065]">
          No catalog items match &quot;{searchQuery.trim()}&quot;.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e6ebe1] bg-white">
          {groups.map((group) => {
            // While searching, every matching category is opened automatically
            const isOpen = Boolean(query) || expandedCategory === group.category
            const label = CATEGORY_LABELS[group.category] || formatCategoryLabel(group.category)
            let inStockCount = 0
            let pendingCount = 0
            group.subcategories.forEach(({ items }) =>
              items.forEach((item) => {
                const state = getEffectiveState(item, entryByItemId.get(item.id), drafts[item.id])
                if (state.is_available) inStockCount += 1
                if (drafts[item.id]) pendingCount += 1
              }),
            )
            const panelId = `editor-panel-${group.category}`

            return (
              <section key={group.category} className="border-b border-[#eef1ea] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggleCategory(group.category)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f7f9f4]"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 text-[#36583b] transition-transform duration-150 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="flex-1 text-base font-bold text-[#253b2d]">{label}</span>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-[#fdf1d8] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a00]">
                      {pendingCount} edited
                    </span>
                  )}
                  <span className="text-xs font-medium text-[#7a8075]">
                    {inStockCount} / {group.total}
                  </span>
                </button>

                {isOpen && (
                  <div id={panelId} className="space-y-4 px-4 pt-1 pb-4">
                    {group.subcategories.map(({ subcategory, items }) => (
                      <div key={subcategory}>
                        <h4 className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-[#7a8075] uppercase">
                          {formatCategoryLabel(subcategory)}
                        </h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {items.map((item) => {
                            const entry = entryByItemId.get(item.id)
                            return (
                              <EditorItemTile
                                key={item.id}
                                item={item}
                                unit={getItemUnit(item, entry)}
                                state={getEffectiveState(item, entry, drafts[item.id])}
                                changed={Boolean(drafts[item.id])}
                                onIncrement={handleIncrement}
                                onDecrement={handleDecrement}
                                onSetQuantity={handleSetQuantity}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* Sticky save bar (replaces bottom navigation bar while in edit mode) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex min-h-[83px] items-center border-t border-[#e0e6da] bg-white px-6 pt-[10px] pb-[max(10px,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] max-[520px]:min-h-[79px] max-[520px]:px-4">
        <div className="mx-auto flex w-full max-w-[880px] items-center justify-between gap-3">
          <span className="text-sm text-[#4f5d50]" aria-live="polite">
            {changeCount === 0
              ? 'No changes yet'
              : `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExit}
              disabled={saving}
              className="rounded-xl border border-[#d8dfd2] bg-white px-4 py-2 text-sm font-semibold text-[#4c584e] hover:bg-[#f4f6f1] disabled:opacity-50"
            >
              {changeCount > 0 ? 'Discard' : 'Done'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || changeCount === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#36583b] px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#2a462e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InventoryEditor

