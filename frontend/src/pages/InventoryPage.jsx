import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CookingPot,
  KeyRound,
  Package,
  Plus,
  RefreshCw,
  Search,
  Utensils,
} from 'lucide-react'
import {
  CATALOG_CATEGORIES,
  STORAGE_LOCATIONS,
  createInventoryEntry,
  deleteInventoryEntry,
  fetchInventoryEntries,
  getStoredToken,
  quickAuthenticate,
  updateInventoryEntry,
} from '../api/inventory.js'
import AddInventoryModal from '../components/inventory/AddInventoryModal.jsx'
import DeleteInventoryModal from '../components/inventory/DeleteInventoryModal.jsx'
import EditInventoryModal from '../components/inventory/EditInventoryModal.jsx'
import InventoryItemCard from '../components/inventory/InventoryItemCard.jsx'

const TYPE_TABS = [
  { id: 'all', label: 'All Items' },
  { id: 'ingredient', label: 'Ingredients' },
  { id: 'appliance', label: 'Appliances' },
]

function InventoryPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [authenticating, setAuthenticating] = useState(false)

  // Filters
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [deletingEntry, setDeletingEntry] = useState(null)

  const loadInventory = useCallback(async () => {
    try {
      const data = await fetchInventoryEntries()
      setEntries(Array.isArray(data) ? data : [])
      setNeedsAuth(false)
      setError('')
    } catch (err) {
      if (err.status === 401 || !getStoredToken()) {
        setNeedsAuth(true)
      } else {
        setError(err.message || 'Could not load household inventory')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    fetchInventoryEntries()
      .then((data) => {
        if (!active) return
        setEntries(Array.isArray(data) ? data : [])
        setNeedsAuth(false)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        if (err.status === 401 || !getStoredToken()) {
          setNeedsAuth(true)
        } else {
          setError(err.message || 'Could not load household inventory')
        }
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
    await loadInventory()
  }

  const handleQuickDemoSession = async () => {
    setAuthenticating(true)
    setError('')
    try {
      await quickAuthenticate()
      await loadInventory()
    } catch (err) {
      setError(err.message || 'Failed to start demo session')
    } finally {
      setAuthenticating(false)
    }
  }

  const handleAddEntry = async (payload) => {
    const created = await createInventoryEntry(payload)
    setEntries((prev) =>
      [...prev, created].sort((a, b) =>
        (a.item?.name || '').localeCompare(b.item?.name || ''),
      ),
    )
  }

  const handleUpdateEntry = async (entryId, payload) => {
    const updated = await updateInventoryEntry(entryId, payload)
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
    await deleteInventoryEntry(entryId)
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

  const stats = useMemo(() => {
    const total = entries.length
    const ingredients = entries.filter((e) => e.item?.item_type === 'ingredient').length
    const appliances = entries.filter((e) => e.item?.item_type === 'appliance').length
    const outOfStock = entries.filter((e) => !e.is_available).length
    return { total, ingredients, appliances, outOfStock }
  }, [entries])

  const existingItemIds = useMemo(
    () => entries.map((entry) => entry.item_id),
    [entries],
  )

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
        </div>

        <div className="flex items-center gap-2.5">
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
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#36583b] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#2a462e]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e6ebe1] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#636b5f]">
            <Package className="h-4 w-4 text-[#36583b]" />
            <span>Total Items</span>
          </div>
          <p className="m-0 mt-1.5 text-2xl font-bold text-[#253b2d]">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-[#e6ebe1] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#636b5f]">
            <Utensils className="h-4 w-4 text-[#36583b]" />
            <span>Ingredients</span>
          </div>
          <p className="m-0 mt-1.5 text-2xl font-bold text-[#253b2d]">
            {stats.ingredients}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e6ebe1] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#636b5f]">
            <CookingPot className="h-4 w-4 text-[#2c527a]" />
            <span>Appliances</span>
          </div>
          <p className="m-0 mt-1.5 text-2xl font-bold text-[#253b2d]">
            {stats.appliances}
          </p>
        </div>
        <div className="rounded-2xl border border-[#e6ebe1] bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#636b5f]">
            <AlertCircle className="h-4 w-4 text-[#b42318]" />
            <span>Out of Stock</span>
          </div>
          <p className="m-0 mt-1.5 text-2xl font-bold text-[#253b2d]">
            {stats.outOfStock}
          </p>
        </div>
      </div>

      {/* Standalone Auth Helper Banner when no JWT token is present */}
      {needsAuth && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-[#dce4d5] bg-[#f4f7f0] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#36583b] text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-sm font-bold text-[#253b2d]">
                Authentication Required
              </h2>
              <p className="m-0 text-xs text-[#5d6659]">
                Sign in or start a quick demo household session to view and manage your
                pantry inventory.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={authenticating}
            onClick={handleQuickDemoSession}
            className="shrink-0 rounded-xl bg-[#36583b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a462e] disabled:opacity-50"
          >
            {authenticating ? 'Starting Session...' : 'Start Quick Household Session'}
          </button>
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

        {/* Storage Location Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
              onClick={() => setIsAddOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#36583b] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a462e]"
            >
              <Plus className="h-4 w-4" />
              <span>Add Your First Item</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEntries.map((entry) => (
            <InventoryItemCard
              key={entry.id}
              entry={entry}
              onEdit={setEditingEntry}
              onDelete={setDeletingEntry}
              onQuickUpdate={handleQuickUpdate}
            />
          ))}
        </div>
      )}

      {/* Add / Edit / Delete Modals */}
      {isAddOpen && (
        <AddInventoryModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onAddEntry={handleAddEntry}
          existingItemIds={existingItemIds}
        />
      )}

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
    </section>
  )
}

export default InventoryPage
