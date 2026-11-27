import { useMemo, useState } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { formatCategoryLabel } from '../../api/inventory.js'
import { groupCatalog } from '../../utils/inventoryEditor.js'

/**
 * Search box + category accordion + subcategory grids.
 * The caller decides what each tile looks like (renderTile) and what the
 * right side of each category header shows (renderGroupMeta).
 */
function CatalogBrowser({
  items,
  categories,
  loading,
  renderTile,
  renderGroupMeta,
  searchPlaceholder = 'Search ingredients...',
  panelIdPrefix = 'catalog-panel',
}) {
  const [expandedCategory, setExpandedCategory] = useState(null) // accordion: one open at a time
  const [searchQuery, setSearchQuery] = useState('')
  const query = searchQuery.trim().toLowerCase()

  const labels = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.value, c.label])),
    [categories],
  )

  const groups = useMemo(() => {
    const visible = query
      ? items.filter((item) => (item.name || '').toLowerCase().includes(query))
      : items
    return groupCatalog(visible, categories)
  }, [items, categories, query])

  return (
    <>
      <div className="rounded-2xl border border-[#e6ebe1] bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#777a72]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search catalog"
            placeholder={searchPlaceholder}
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
      </div>

      {loading ? (
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
            const isOpen = Boolean(query) || expandedCategory === group.category
            const label = labels[group.category] || formatCategoryLabel(group.category)
            const panelId = `${panelIdPrefix}-${group.category}`

            return (
              <section key={group.category} className="border-b border-[#eef1ea] last:border-b-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() =>
                    setExpandedCategory((prev) => (prev === group.category ? null : group.category))
                  }
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#f7f9f4]"
                >
                  <ChevronRight
                    aria-hidden="true"
                    className={`h-5 w-5 shrink-0 text-[#36583b] transition-transform duration-150 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                  />
                  <span className="flex-1 text-base font-bold text-[#253b2d]">{label}</span>
                  {renderGroupMeta?.(group)}
                </button>

                {isOpen && (
                  <div id={panelId} className="space-y-4 px-4 pt-1 pb-4">
                    {group.subcategories.map(({ subcategory, items: subItems }) => (
                      <div key={subcategory}>
                        <h4 className="m-0 mb-2 text-[11px] font-semibold tracking-wide text-[#7a8075] uppercase">
                          {formatCategoryLabel(subcategory)}
                        </h4>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {subItems.map((item) => renderTile(item))}
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
    </>
  )
}

export default CatalogBrowser