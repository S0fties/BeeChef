const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export const STORAGE_LOCATIONS = [
  { value: 'fridge', label: 'Fridge' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'counter', label: 'Counter' },
]

export const COMMON_UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'tbsp', 'tsp', 'cup', 'pack']

export const CATALOG_CATEGORIES = [
  { value: 'FRUIT', label: 'Fruit', defaultSubcategory: 'CITRUS', type: 'ingredient' },
  { value: 'VEGETABLE', label: 'Vegetable', defaultSubcategory: 'FRUITING_VEGETABLES', type: 'ingredient' },
  { value: 'GRAIN_LEGUME', label: 'Grain & Legume', defaultSubcategory: 'GRAIN', type: 'ingredient' },
  { value: 'DAIRY_BREAKFAST', label: 'Dairy & Breakfast', defaultSubcategory: 'MILK_YOGURT', type: 'ingredient' },
  { value: 'SPICE_SAUCE', label: 'Spice & Sauce', defaultSubcategory: 'DRY_SPICE', type: 'ingredient' },
  { value: 'BAKERY_PANTRY', label: 'Bakery & Pantry', defaultSubcategory: 'BAKERY_BREAD', type: 'ingredient' },
  { value: 'MEAT', label: 'Meat & Seafood', defaultSubcategory: 'POULTRY', type: 'ingredient' },
  { value: 'COOKING_APPLIANCE', label: 'Cooking Appliance', defaultSubcategory: 'ELECTRIC_COOKER', type: 'appliance' },
  { value: 'KITCHENWARE', label: 'Kitchenware', defaultSubcategory: 'COOKWARE', type: 'appliance' },
]

export function getMealDbImageUrl(itemName, size = 'small') {
  if (!itemName) return null
  const encoded = encodeURIComponent(itemName.trim())
  return size === 'small'
    ? `https://www.themealdb.com/images/ingredients/${encoded}-small.png`
    : `https://www.themealdb.com/images/ingredients/${encoded}.png`
}

export function formatCategoryLabel(category) {
  if (!category) return 'Other'
  return category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function getStoredToken() {
  try {
    return localStorage.getItem('token') || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
  } catch {
    // ignore storage errors in restricted environments
  }
}

function buildHeaders(customHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }
  const token = getStoredToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function handleResponse(response) {
  if (response.status === 204) {
    return null
  }

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail.map((err) => err.msg).join(', ')
          : `Request failed with status ${response.status}`
    const error = new Error(detail)
    error.status = response.status
    throw error
  }

  return data
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value))
    }
  })
  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export async function fetchCatalogItems(params = {}) {
  const query = buildQuery(params)
  const response = await fetch(`${API_BASE}/items${query}`, {
    method: 'GET',
    headers: buildHeaders(),
  })
  return handleResponse(response)
}

export async function createCatalogItem(payload) {
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function fetchInventoryEntries(params = {}) {
  const query = buildQuery(params)
  const response = await fetch(`${API_BASE}/inventory${query}`, {
    method: 'GET',
    headers: buildHeaders(),
  })
  return handleResponse(response)
}

export async function createInventoryEntry(payload) {
  const response = await fetch(`${API_BASE}/inventory`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function updateInventoryEntry(entryId, payload) {
  const response = await fetch(`${API_BASE}/inventory/${entryId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  })
  return handleResponse(response)
}

export async function deleteInventoryEntry(entryId) {
  const response = await fetch(`${API_BASE}/inventory/${entryId}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  })
  return handleResponse(response)
}

export async function quickAuthenticate({
  email = 'chef@beechef.local',
  password = 'beechef-demo-password',
  full_name = 'BeeChef Demo User',
} = {}) {
  // Try logging in first; if user doesn't exist yet, register and then log in.
  let loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!loginRes.ok) {
    await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name }),
    })
    loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  }

  const data = await handleResponse(loginRes)
  if (data?.access_token) {
    setStoredToken(data.access_token)
  }
  return data
}

