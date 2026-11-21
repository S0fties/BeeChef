import { useCallback, useMemo, useState } from 'react'
import { CATALOG_CATEGORIES } from '../../api/inventory.js'
import { useCatalogItems } from '../../hooks/useCatalogItems.js'
import { useHideMainNav } from '../../hooks/useHideMainNav.js'
import CatalogBrowser from '../editor/CatalogBrowser.jsx'
import EditorSaveBar from '../editor/EditorSaveBar.jsx'
import PreferencePickerTile from './PreferencePickerTile.jsx'
import { PREFERENCE_TONES } from './preferenceTones.js'

const INGREDIENT_CATEGORIES = CATALOG_CATEGORIES.filter((c) => c.type === 'ingredient')

/**
 * Inventory-style full-page picker for adding items to one list.
 * Selections are staged locally and sent together via onSave(ids).
 */
function PreferencePicker({ mode, prefs, onSave, onExit }) {
  useHideMainNav()
  const { items, loading, error: loadError } = useCatalogItems()
  const [selected, setSelected] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const t = PREFERENCE_TONES[mode]

  // Preferences only make sense for ingredients, not appliances.
  const ingredients = useMemo(() => items.filter((i) => i.item_type !== 'appliance'), [items])

  // Where each item currently lives. Allergic wins if an item is in several lists.
  const statusById = useMemo(() => {
    const map = new Map()
    prefs.preferred.forEach((i) => map.set(i.id, 'preferred'))
    prefs.restricted.forEach((i) => map.set(i.id, 'restricted'))
    prefs.allergy_items.forEach((i) => map.set(i.id, 'allergic'))
    return map
  }, [prefs])

  const handleToggle = useCallback((item) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const handleSave = async () => {
    if (selected.size === 0) {
      onExit()
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave([...selected])
    } catch (err) {
      setError(err.message || 'Could not save your changes')
      setSaving(false)
    }
  }

  const renderTile = (item) => {
    const existing = statusById.get(item.id)
    const locked = existing === mode
    // An allergic item cannot also be preferred/restricted.
    const disabled = mode !== 'allergic' && existing === 'allergic'
    let note = ''
    if (locked) note = 'Already added'
    else if (disabled) note = 'Marked as allergic'
    else if (existing) note = `Currently ${existing}. Will be moved`

    return (
      <PreferencePickerTile
        key={item.id}
        item={item}
        tone={mode}
        selected={selected.has(item.id)}
        locked={locked}
        disabled={disabled}
        note={note}
        onToggle={handleToggle}
      />
    )
  }

  const renderGroupMeta = (group) => {
    let picked = 0
    let added = 0
    group.subcategories.forEach(({ items: subItems }) =>
      subItems.forEach((item) => {
        if (selected.has(item.id)) picked += 1
        if (statusById.get(item.id) === mode) added += 1
      }),
    )
    return (
      <>
        {picked > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.badge}`}>
            {picked} selected
          </span>
        )}
        <span className="text-xs font-medium text-[#7a8075]">
          {added} / {group.total}
        </span>
      </>
    )
  }

  const shownError = error || loadError

  return (
    <div className="space-y-3 pb-24">
      {shownError && (
        <div
          role="alert"
          className="rounded-2xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm font-medium text-[#b42318]"
        >
          {shownError}
        </div>
      )}

      <CatalogBrowser
        items={ingredients}
        categories={INGREDIENT_CATEGORIES}
        loading={loading}
        renderTile={renderTile}
        renderGroupMeta={renderGroupMeta}
        searchPlaceholder="Search ingredients..."
        panelIdPrefix={`picker-panel-${mode}`}
      />

      <EditorSaveBar
        changeCount={selected.size}
        saving={saving}
        onSave={handleSave}
        onExit={onExit}
        noChangesLabel="Nothing selected yet"
        changeLabel={(n) => `${n} selected`}
        saveLabel="Save"
      />
    </div>
  )
}

export default PreferencePicker