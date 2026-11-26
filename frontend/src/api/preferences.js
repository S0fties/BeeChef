import { API_V1_BASE, fetchWithAuth } from './inventory.js'

const BASE = `${API_V1_BASE}/preferences`

// Must match ALLERGY_LABELS in the backend schema.
export const ALLERGY_LABELS = [
  { value: 'tree nuts', label: 'Tree nuts' },
  { value: 'peanuts', label: 'Peanuts' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'gluten', label: 'Gluten' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'soy', label: 'Soy' },
  { value: 'fish', label: 'Fish' },
  { value: 'sesame', label: 'Sesame' },
]

const post = (path, body) =>
  fetchWithAuth(`${BASE}${path}`, { method: 'POST', body: JSON.stringify(body) })

// Every call resolves to the full, updated preferences object:
// { preferred: Item[], restricted: Item[], allergy_items: Item[], allergy_labels: string[] }

export const fetchPreferences = () => fetchWithAuth(BASE, { method: 'GET' })

/** preferences: [{ item_id, pref: 'preferred' | 'restricted' }] (upsert) */
export const addItemPreferences = (preferences) => post('/items', { preferences })
export const deleteItemPreferences = (itemIds) => post('/items/delete', { item_ids: itemIds })

export const addAllergyItems = (itemIds) => post('/allergies/items', { item_ids: itemIds })
export const deleteAllergyItems = (itemIds) =>
  post('/allergies/items/delete', { item_ids: itemIds })

export const addAllergyLabels = (labels) => post('/allergies/labels', { labels })
export const deleteAllergyLabels = (labels) => post('/allergies/labels/delete', { labels })