// Pure helpers for the in-page inventory edit mode.
// Drafts are keyed by catalog item id: { [itemId]: { quantity, is_available } }

export function getQuantityStep(unit) {
  if (unit === 'g' || unit === 'ml') return 100
  if (unit === 'kg' || unit === 'l') return 0.5
  return 1
}

export function roundQuantity(value) {
  return Number(Number(value).toFixed(2))
}

export function getDefaultLocation(item) {
  if (!item) return null
  if (item.item_type === 'appliance') return 'counter'
  switch (item.category) {
    case 'MEAT':
    case 'DAIRY_BREAKFAST':
    case 'VEGETABLE':
      return 'fridge'
    case 'FRUIT':
      return 'counter'
    default:
      return 'pantry'
  }
}

export function getItemUnit(item, entry) {
  if (!item || item.item_type === 'appliance') return null
  return entry?.unit || item.default_unit || 'piece'
}

/** The state shown in the editor: draft > existing entry > empty. */
export function getEffectiveState(item, entry, draft) {
  if (draft) return draft
  if (entry) return { quantity: entry.quantity, is_available: entry.is_available }
  return {
    quantity: item?.item_type === 'appliance' ? null : 0,
    is_available: false,
  }
}

function isSameAsOriginal(item, entry, state) {
  if (entry) {
    return (
      (state.quantity ?? null) === (entry.quantity ?? null) &&
      Boolean(state.is_available) === Boolean(entry.is_available)
    )
  }
  // No entry yet: an "empty" draft is not a change
  return !state.is_available && !(state.quantity > 0)
}

/** Returns a new drafts object with `nextState` applied (or removed if it equals the original). */
export function applyDraft(drafts, item, entry, nextState) {
  const next = { ...drafts }
  if (isSameAsOriginal(item, entry, nextState)) {
    delete next[item.id]
  } else {
    next[item.id] = nextState
  }
  return next
}

export function incrementState(item, entry, state) {
  if (item.item_type === 'appliance') {
    return { quantity: null, is_available: true }
  }
  const step = getQuantityStep(getItemUnit(item, entry))
  const base = state.quantity ?? 0
  const quantity = roundQuantity(base + step)
  return { quantity, is_available: quantity > 0 }
}

export function decrementState(item, entry, state) {
  if (item.item_type === 'appliance') {
    return { quantity: null, is_available: false }
  }
  if (state.quantity === null || state.quantity === undefined) {
    // Quick "available" tracking without a quantity -> mark as out of stock
    return { quantity: null, is_available: false }
  }
  const step = getQuantityStep(getItemUnit(item, entry))
  const quantity = Math.max(0, roundQuantity(state.quantity - step))
  return { quantity, is_available: quantity > 0 }
}

export function setQuantityState(rawValue) {
  const parsed = Number(rawValue)
  const quantity = rawValue === '' || Number.isNaN(parsed) || parsed < 0 ? 0 : roundQuantity(parsed)
  return { quantity, is_available: quantity > 0 }
}

/**
 * Converts drafts into API operations.
 * @returns {{ creates: object[], updates: { id: number, payload: object }[] }}
 */
export function buildInventoryChanges(entries, drafts, catalogById) {
  const entryByItemId = new Map(entries.map((entry) => [entry.item_id, entry]))
  const creates = []
  const updates = []

  Object.entries(drafts).forEach(([itemIdKey, state]) => {
    const itemId = Number(itemIdKey)
    const entry = entryByItemId.get(itemId)
    const item = entry?.item || catalogById.get(itemId)
    if (!item) return
    const isAppliance = item.item_type === 'appliance'

    if (entry) {
      const payload = {
        quantity: isAppliance ? null : state.quantity ?? null,
        is_available: Boolean(state.is_available),
      }
      if (!isAppliance && payload.quantity !== null && !entry.unit) {
        payload.unit = getItemUnit(item, entry)
      }
      updates.push({ id: entry.id, payload })
      return
    }

    if (!state.is_available && !(state.quantity > 0)) return
    creates.push({
      item_id: itemId,
      quantity: isAppliance ? null : state.quantity ?? null,
      unit: isAppliance ? null : getItemUnit(item, null),
      is_available: Boolean(state.is_available),
      location: getDefaultLocation(item),
    })
  })

  return { creates, updates }
}

/**
 * Groups catalog items by category (in `categoryOrder`) and subcategory (by id order).
 * Items already in the inventory come first inside each subcategory, then alphabetical.
 */
export function groupCatalog(items, categoryOrder, inventoryItemIds = new Set()) {
  const byCategory = new Map(categoryOrder.map((cat) => [cat.value, new Map()]))

  const sorted = [...items].sort((a, b) => a.id - b.id)
  sorted.forEach((item) => {
    if (!byCategory.has(item.category)) byCategory.set(item.category, new Map())
    const subMap = byCategory.get(item.category)
    const subKey = item.subcategory || 'OTHER'
    if (!subMap.has(subKey)) subMap.set(subKey, [])
    subMap.get(subKey).push(item)
  })

  const groups = []
  byCategory.forEach((subMap, category) => {
    if (subMap.size === 0) return
    const subcategories = []
    let total = 0
    subMap.forEach((subItems, subcategory) => {
      const ordered = [...subItems].sort((a, b) => {
        const aIn = inventoryItemIds.has(a.id) ? 0 : 1
        const bIn = inventoryItemIds.has(b.id) ? 0 : 1
        if (aIn !== bIn) return aIn - bIn
        return (a.name || '').localeCompare(b.name || '')
      })
      total += ordered.length
      subcategories.push({ subcategory, items: ordered })
    })
    groups.push({ category, subcategories, total })
  })
  return groups
}

