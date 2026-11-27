import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CookingPot,
  Home,
  Package,
  PackageX,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  CATALOG_CATEGORIES,
  STORAGE_LOCATIONS,
  createHousehold,
  createInventoryEntry,
  deleteInventoryEntry,
  fetchInventoryEntries,
  fetchUserHouseholds,
  formatCategoryLabel,
  updateInventoryEntry,
} from '../api/inventory.js'
import DeleteInventoryModal from '../components/inventory/DeleteInventoryModal.jsx'
import EditInventoryModal from '../components/inventory/EditInventoryModal.jsx'
import InventoryEditor from '../components/inventory/InventoryEditor.jsx'
import InventoryItemCard from '../components/inventory/InventoryItemCard.jsx'
import ReceiptScanModal from '../components/inventory/ReceiptScanModal.jsx'

const TYPE_TABS = [
  { id: 'all', label: 'All Items' },
  { id: 'ingredient', label: 'Ingredients' },
  { id: 'appliance', label: 'Appliances' },
]

const CATEGORY_LABEL_MAP = new Map(CATALOG_CATEGORIES.map((c) => [c.value, c.label]))

function sortEntriesForDisplay(entriesList) {
  return [...entriesList].sort((a, b) => {
    const availDiff = Number(Boolean(b.is_available)) - Number(Boolean(a.is_available))
    if (availDiff !== 0) return availDiff
    return (a.item?.name || '').localeCompare(b.item?.name || '')
  })
}

function buildEntryGroups(entriesList, groupByMode) {
  const grouped = new Map()
  if (groupByMode === 'location') {
    STORAGE_LOCATIONS.forEach((loc) =>
      grouped.set(loc.value, { key: loc.value, label: loc.label, entries: [] }),
    )
    grouped.set('unassigned', {
      key: 'unassigned',
      label: 'Other / Unassigned',
      entries: [],
    })
    entriesList.forEach((entry) => {
      const locKey = (entry.location || '').toLowerCase()
      const bucketKey = grouped.has(locKey) ? locKey : 'unassigned'
      grouped.get(bucketKey).entries.push(entry)
    })
  } else {
    CATALOG_CATEGORIES.forEach((cat) =>
      grouped.set(cat.value, { key: cat.value, label: cat.label, entries: [] }),
    )
    entriesList.forEach((entry) => {
      const catKey = entry.item?.category || 'OTHER'
      if (!grouped.has(catKey)) {
        grouped.set(catKey, {
          key: catKey,
          label: CATEGORY_LABEL_MAP.get(catKey) || formatCategoryLabel(catKey),
          entries: [],
        })
      }
      grouped.get(catKey).entries.push(entry)
    })
  }

  return [...grouped.values()]
    .filter((group) => group.entries.length > 0)
    .map((group) => ({ ...group, entries: sortEntriesForDisplay(group.entries) }))
}

async function fetchHouseholdAndInventory(preferredHouseholdId = null) {
  const householdList = await fetchUserHouseholds()
  const normalizedHouseholds = Array.isArray(householdList) ? householdList : []
  let resolvedId = null
  if (normalizedHouseholds.length > 0) {
    const hasPreferred =
      preferredHouseholdId !== null &&
      normalizedHouseholds.some((h) => h.id === preferredHouseholdId)
    resolvedId = hasPreferred ? preferredHouseholdId : normalizedHouseholds[0].id
  }
  const entryList = await fetchInventoryEntries(
    resolvedId !== null ? { household_id: resolvedId } : {},
  )
  return {
    households: normalizedHouseholds,
    householdId: resolvedId,
    entries: Array.isArray(entryList) ? entryList : [],
  }
}

function InventoryPage() {
  const [entries, setEntries] = useState([])
  const [households, setHouseholds] = useState([])
  const [activeHouseholdId, setActiveHouseholdId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [creatingHousehold, setCreatingHousehold] = useState(false)

  // Filters & grouping
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [groupBy, setGroupBy] = useState('category')

  // Edit mode (in-page catalog editor) & modals
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)
  const [isScanOpen, setIsScanOpen] = useState(false)

  const loadInventory = useCallback(
    async (preferredHouseholdId = activeHouseholdId) => {
      try {
        const {
          households: nextHouseholds,
          householdId,
          entries: nextEntries,
        } = await fetchHouseholdAndInventory(preferredHouseholdId)
        setHouseholds(nextHouseholds)
        setActiveHouseholdId(householdId)
        setEntries(nextEntries)
        setError('')
      } catch (err) {
        setError(err.message || 'Could not load household inventory')
      } finally {
        setLoading(false)
      }
    },
    [activeHouseholdId],
  )

  useEffect(() => {
    let active = true
    fetchHouseholdAndInventory()
      .then(({ households: nextHouseholds, householdId, entries: nextEntries }) => {
        if (!active) return
        setHouseholds(nextHouseholds)
        setActiveHouseholdId(householdId)
        setEntries(nextEntries)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'Could not load household inventory')
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    await loadInventory(activeHouseholdId)
  }

  const handleSelectHousehold = async (e) => {
    const nextId = Number(e.target.value)
    setActiveHouseholdId(nextId)
    setIsEditMode(false)
    setLoading(true)
    setError('')
    try {
      const data = await fetchInventoryEntries({ household_id: nextId })
      setEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not load household inventory')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateHousehold = async (e) => {
    e.preventDefault()
    setCreatingHousehold(true)
    setError('')
    try {
      const created = await createHousehold({
        name: newHouseholdName.trim() || 'My Household',
      })
      setNewHouseholdName('')
      setHouseholds([created])
      setActiveHouseholdId(created.id)
      const data = await fetchInventoryEntries({ household_id: created.id })
      setEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Could not create household')
    } finally {
      setCreatingHousehold(false)
    }
  }

  // Applies all staged edit-mode changes, then reloads the inventory from the API.
  const handleCommitChanges = async ({ creates, updates }) => {
    const householdParams =
      activeHouseholdId !== null ? { household_id: activeHouseholdId } : {}
    const results = await Promise.allSettled([
      ...creates.map((payload) =>
        createInventoryEntry(
          activeHouseholdId !== null
            ? { ...payload, household_id: activeHouseholdId }
            : payload,
        ),
      ),
      ...updates.map(({ id, payload }) =>
        updateInventoryEntry(id, payload, householdParams),
      ),
    ])
    await loadInventory(activeHouseholdId)
    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      throw new Error(
        `${failed.length} change(s) could not be saved: ${failed[0].reason?.message || 'unknown error'}`,
      )
    }
  }

  const handleUpdateEntry = async (entryId, payload) => {
    const householdParams =
      activeHouseholdId !== null ? { household_id: activeHouseholdId } : {}
    const updated = await updateInventoryEntry(entryId, payload, householdParams)
    setEntries((prev) =>
      prev.map((entry) => (entry.id === entryId ? updated : entry)),
    )
  }

  const handleQuickUpdate = async (entry, payload) => {
    try {
      await handleUpdateEntry(entry.id, payload)
    } catch (err) {
      setError(err.message || 'Could not update item')
    }
  }

  const handleDeleteEntry = async (entryId) => {
    const householdParams =
      activeHouseholdId !== null ? { household_id: activeHouseholdId } : {}
    await deleteInventoryEntry(entryId, householdParams)
    setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
  }

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const item = entry.item || {}
      if (activeTab !== 'all' && item.item_type !== activeTab) {
        return false
      }
      if (selectedLocation && (entry.location || '').toLowerCase() !== selectedLocation) {
        return false
      }
      if (selectedCategory && item.category !== selectedCategory) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchName = (item.name || '').toLowerCase().includes(q)
        const matchCategory = (item.category || '').toLowerCase().includes(q)
        if (!matchName && !matchCategory) return false
      }
      return true
    })
  }, [entries, activeTab, selectedLocation, selectedCategory, searchQuery])

  const ingredientEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.item?.item_type !== 'appliance'),
    [filteredEntries],
  )

  const applianceEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.item?.item_type === 'appliance'),
    [filteredEntries],
  )

  const ingredientGroups = useMemo(
    () => buildEntryGroups(ingredientEntries, groupBy),
    [ingredientEntries, groupBy],
  )

  const sortedAppliances = useMemo(
    () => sortEntriesForDisplay(applianceEntries),
    [applianceEntries],
  )

  const outOfStockNames = useMemo(
    () =>
      entries
        .filter((e) => !e.is_available)
        .map((e) => e.item?.name || 'Unknown item')
        .sort((a, b) => a.localeCompare(b)),
    [entries],
  )

  const hasNoHousehold = !loading && households.length === 0 && entries.length === 0
  const activeHousehold =
    households.find((h) => h.id === activeHouseholdId) || households[0] || null

  return (
    <section className="w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="m-0 text-[clamp(32px,5vw,48px)] font-bold tracking-[-1.5px] text-[#253b2d]">
            Inventory
          </h1>
          <p className="m-0 mt-1 text-sm text-[#636b5f]">
            Manage your household pantry ingredients and kitchen appliances
          </p>
          {households.length === 1 && activeHousehold && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#dce4d5] bg-[#f4f7f0] px-3 py-1 text-xs font-medium text-[#253b2d]">
              <Home className="h-3.5 w-3.5 text-[#36583b]" aria-hidden="true" />
              <span>{activeHousehold.name}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5d6659]">
                {activeHousehold.role}
              </span>
            </div>
          )}
          {households.length > 1 && (
            <div className="mt-2 flex items-center gap-2">
              <Home className="h-4 w-4 text-[#36583b]" aria-hidden="true" />
              <select
                aria-label="Select household"
                value={activeHouseholdId ?? ''}
                onChange={handleSelectHousehold}
                disabled={isEditMode}
                className="rounded-xl border border-[#d8dfd2] bg-white px-3 py-1.5 text-xs font-semibold text-[#253b2d] focus:border-[#36583b] focus:outline-none disabled:opacity-60"
              >
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.name} ({household.role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {!isEditMode && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh inventory"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8dfd2] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#36583b] transition-colors hover:bg-[#f2f5ee]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setIsScanOpen(true)}
              disabled={loading || hasNoHousehold}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8dfd2] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#36583b] transition-colors hover:bg-[#f2f5ee] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Receipt className="h-4 w-4" />
              <span>Scan Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              disabled={loading || hasNoHousehold}
              className="inline-flex items-center gap-2 rounded-xl bg-[#36583b] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#2a462e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="h-4 w-4" />
              <span>Edit Inventory</span>
            </button>
          </div>
        )}
        {isEditMode && (
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#fdf1d8] px-3 py-1 text-xs font-semibold text-[#8a5a00] sm:self-center">
            <Pencil className="h-3.5 w-3.5" />
            Edit mode — use + / − to update your stock, then save
          </span>
        )}
      </div>

      {/* Compact one-line out-of-stock card: only rendered when something has run out */}
      {outOfStockNames.length > 0 && (
        <div
          data-testid="out-of-stock-note"
          className="flex items-center gap-3 rounded-xl border border-[#e6ebe1] bg-white px-4 py-2.5 shadow-2xs"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f6f1e7] text-[#9a7b4f]">
            <PackageX className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="shrink-0 text-sm font-semibold text-[#3f4a40]">Out of stock</span>
          <span className="min-w-0 flex-1 truncate text-sm text-[#7a8075]" title={outOfStockNames.join(', ')}>
            {outOfStockNames.join(', ')}
          </span>
          <span className="shrink-0 rounded-full bg-[#f3f5ef] px-2 py-0.5 text-xs font-medium text-[#5d6659]">
            {outOfStockNames.length} {outOfStockNames.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm font-medium text-[#b42318]"
        >
          {error}
        </div>
      )}

      {hasNoHousehold ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#dce4d5] bg-white px-6 py-12 text-center shadow-2xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2e8] text-[#36583b]">
            <Home className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="m-0 mt-3 text-lg font-bold text-[#253b2d]">
            No Household Found
          </h2>
          <p className="m-0 mt-1 max-w-md text-xs text-[#5d6659]">
            Create a household to manage your inventory, track ingredients, and share your kitchen pantry.
          </p>
          <form
            onSubmit={handleCreateHousehold}
            className="mt-5 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row"
          >
            <input
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              aria-label="Household name"
              placeholder="e.g. My Home Kitchen"
              maxLength={100}
              className="flex-1 rounded-xl border border-[#d8dfd2] bg-[#fafbf8] px-3.5 py-2 text-sm text-[#253b2d] placeholder:text-[#8c9187] focus:border-[#36583b] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingHousehold}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#36583b] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#2a462e] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{creatingHousehold ? 'Creating...' : 'Create Household'}</span>
            </button>
          </form>
        </div>
      ) : isEditMode ? (
        <InventoryEditor
          entries={entries}
          onCommit={handleCommitChanges}
          onExit={() => setIsEditMode(false)}
        />
      ) : (
      <>
      {/* Search & Filter Toolbar */}
      <div className="space-y-3 rounded-2xl border border-[#e6ebe1] bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Type Tabs */}
          <div
            role="tablist"
            aria-label="Filter by item type"
            className="inline-flex rounded-xl bg-[#f3f5ef] p-1"
          >
            {TYPE_TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-white text-[#253b2d] shadow-2xs'
                      : 'text-[#666e62] hover:text-[#253b2d]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Search Input & Category Select */}
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row md:max-w-lg">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#777a72]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search inventory items"
                placeholder="Search inventory items..."
                className="w-full rounded-xl border border-[#d8dfd2] bg-[#fafbf8] py-2 pr-3 pl-9 text-sm text-[#253b2d] placeholder:text-[#8c9187] focus:border-[#36583b] focus:bg-white focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-xl border border-[#d8dfd2] bg-[#fafbf8] px-3 py-2 text-sm text-[#253b2d] focus:border-[#36583b] focus:outline-none"
            >
              <option value="">All Categories</option>
              {CATALOG_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Storage Location Filter Pills & Group By Toggle */}
        <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-[#697065]">Location:</span>
            <button
              type="button"
              onClick={() => setSelectedLocation('')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                selectedLocation === ''
                  ? 'bg-[#36583b] text-white'
                  : 'bg-[#f3f5ef] text-[#5c6558] hover:bg-[#e7ece1]'
              }`}
            >
              All Locations
            </button>
            {STORAGE_LOCATIONS.map((loc) => {
              const active = selectedLocation === loc.value
              return (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => setSelectedLocation(active ? '' : loc.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#36583b] text-white'
                      : 'bg-[#f3f5ef] text-[#5c6558] hover:bg-[#e7ece1]'
                  }`}
                >
                  {loc.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-xs font-semibold text-[#697065]">Group by:</span>
            <div className="inline-flex rounded-lg bg-[#f3f5ef] p-0.5">
              <button
                type="button"
                aria-pressed={groupBy === 'category'}
                onClick={() => setGroupBy('category')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  groupBy === 'category'
                    ? 'bg-white text-[#253b2d] shadow-2xs'
                    : 'text-[#666e62] hover:text-[#253b2d]'
                }`}
              >
                By Category
              </button>
              <button
                type="button"
                aria-pressed={groupBy === 'location'}
                onClick={() => setGroupBy('location')}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  groupBy === 'location'
                    ? 'bg-white text-[#253b2d] shadow-2xs'
                    : 'text-[#666e62] hover:text-[#253b2d]'
                }`}
              >
                By Location
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory List View */}
      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-[#e6ebe1] bg-white py-14 text-center text-sm text-[#697065]"
        >
          Loading household inventory...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfd8c8] bg-white px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf2e8] text-[#36583b]">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="m-0 mt-3 text-base font-bold text-[#253b2d]">
            {entries.length === 0
              ? 'Your pantry inventory is empty'
              : 'No items match your filters'}
          </h2>
          <p className="m-0 mt-1 max-w-sm text-xs text-[#697065]">
            {entries.length === 0
              ? 'Start adding ingredients and kitchen appliances to generate smart AI recipes.'
              : 'Try clearing your search query or switching category/location filters.'}
          </p>
          {entries.length === 0 && (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#36583b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a462e]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Your First Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {ingredientGroups.map((group) => (
            <div key={group.key} data-testid={`inventory-group-${group.key}`}>
              <div className="mb-2.5 flex items-center justify-between border-b border-[#e6ebe1] pb-1.5">
                <h2 className="m-0 text-sm font-bold tracking-tight text-[#253b2d]">
                  {group.label}
                </h2>
                <span className="rounded-full bg-[#eef2e8] px-2.5 py-0.5 text-[11px] font-semibold text-[#36583b]">
                  {group.entries.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {group.entries.map((entry) => (
                  <InventoryItemCard
                    key={entry.id}
                    entry={entry}
                    groupBy={groupBy}
                    onEdit={setEditingEntry}
                    onDelete={setDeletingEntry}
                    onQuickUpdate={handleQuickUpdate}
                  />
                ))}
              </div>
            </div>
          ))}

          {sortedAppliances.length > 0 && (
            <div
              data-testid="appliances-section"
              className={
                ingredientEntries.length > 0
                  ? 'border-t-2 border-dashed border-[#dce4d5] pt-6'
                  : ''
              }
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8eff7] text-[#2c527a]">
                    <CookingPot className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="m-0 text-sm font-bold tracking-tight text-[#253b2d]">
                      Kitchen Appliances &amp; Tools
                    </h2>
                    <p className="m-0 text-[11px] text-[#697065]">
                      Cooking appliances and kitchenware available in your home
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-[#e8eff7] px-2.5 py-0.5 text-[11px] font-semibold text-[#2c527a]">
                  {sortedAppliances.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedAppliances.map((entry) => (
                  <InventoryItemCard
                    key={entry.id}
                    entry={entry}
                    groupBy={groupBy}
                    onEdit={setEditingEntry}
                    onDelete={setDeletingEntry}
                    onQuickUpdate={handleQuickUpdate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Edit / Delete Modals */}

      {editingEntry && (
        <EditInventoryModal
          key={editingEntry.id}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={handleUpdateEntry}
        />
      )}

      {deletingEntry && (
        <DeleteInventoryModal
          key={deletingEntry.id}
          entry={deletingEntry}
          onClose={() => setDeletingEntry(null)}
          onConfirmDelete={handleDeleteEntry}
        />
      )}

      {isScanOpen && (
        <ReceiptScanModal
          onClose={() => setIsScanOpen(false)}
          onItemsAdded={() => loadInventory()}
        />
      )}
    </section>
  )
}

export default InventoryPage
