import { getToken } from '../services/api.js'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export const API_V1_BASE = `${API_ORIGIN}/api/v1`
const AUTH_BASE = `${API_V1_BASE}/auth`

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

export const APPLIANCE_IMAGE_MAP = {
  'air fryer': '/images/appliances/air-fryer.svg',
  'microwave oven': '/images/appliances/microwave-oven.svg',
  toaster: '/images/appliances/toaster.svg',
  oven: '/images/appliances/oven.svg',
  stove: '/images/appliances/stove.svg',
  'pressure cooker': '/images/appliances/pressure-cooker.svg',
  'steel pot': '/images/appliances/steel-pot.svg',
  'frying pan': '/images/appliances/frying-pan.svg',
  'turkish coffee pot': '/images/appliances/turkish-coffee-pot.svg',
  'hand blender': '/images/appliances/hand-blender.svg',
  grater: '/images/appliances/grater.svg',
  'cutting board': '/images/appliances/cutting-board.svg',
}

const APPLIANCE_IMAGE_KEYWORDS = [
  { keywords: ['air fryer', 'airfryer'], src: '/images/appliances/air-fryer.svg' },
  { keywords: ['microwave'], src: '/images/appliances/microwave-oven.svg' },
  { keywords: ['cezve', 'coffee pot'], src: '/images/appliances/turkish-coffee-pot.svg' },
  { keywords: ['toaster'], src: '/images/appliances/toaster.svg' },
  { keywords: ['stove'], src: '/images/appliances/stove.svg' },
  { keywords: ['oven'], src: '/images/appliances/oven.svg' },
  { keywords: ['cooker'], src: '/images/appliances/pressure-cooker.svg' },
  { keywords: ['pan', 'skillet'], src: '/images/appliances/frying-pan.svg' },
  { keywords: ['pot'], src: '/images/appliances/steel-pot.svg' },
  { keywords: ['blender'], src: '/images/appliances/hand-blender.svg' },
  { keywords: ['grater'], src: '/images/appliances/grater.svg' },
  { keywords: ['board'], src: '/images/appliances/cutting-board.svg' },
]

export function getApplianceImageUrl(itemName) {
  if (!itemName) return null
  const normalized = itemName.trim().toLowerCase()
  if (APPLIANCE_IMAGE_MAP[normalized]) {
    return APPLIANCE_IMAGE_MAP[normalized]
  }
  const match = APPLIANCE_IMAGE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  )
  return match ? match.src : null
}

export function getMealDbImageUrl(itemName, size = 'small') {
  if (!itemName) return null
  const encoded = encodeURIComponent(itemName.trim())
  return size === 'small'
    ? `https://www.themealdb.com/images/ingredients/${encoded}-small.png`
    : `https://www.themealdb.com/images/ingredients/${encoded}.png`
}

export function getItemImageUrl(item, size = 'small') {
  if (!item || !item.name) return null
  if (item.item_type === 'appliance') {
    return getApplianceImageUrl(item.name)
  }
  return getMealDbImageUrl(item.name, size)
}

export function formatCategoryLabel(category) {
  if (!category) return 'Other'
  return category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Prefer the real login token ("access_token", set by AuthContext); fall back to the
// legacy demo-session key ("token") used by quickAuthenticate.
export function getStoredToken() {
  try {
    return localStorage.getItem('access_token') || localStorage.getItem('token') || ''
  } catch {
    return ''
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
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

export async function quickAuthenticate({
  email = 'chef@beechef.com',
  password = 'beechef-demo-password',
  name = 'BeeChef',
  surname = 'Demo',
  user_name = 'beechef_demo',
} = {}) {
  // Try logging in first; if user doesn't exist yet, register and then log in.
  let loginRes = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!loginRes.ok) {
    await fetch(`${AUTH_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, surname, user_name }),
    })
    loginRes = await fetch(`${AUTH_BASE}/login`, {
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

export async function fetchWithAuth(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  })

  return handleResponse(response)
}

export async function fetchUserHouseholds() {
  return fetchWithAuth(`${API_V1_BASE}/households`, {
    method: 'GET',
  })
}

export async function createHousehold(payload) {
  return fetchWithAuth(`${API_V1_BASE}/households`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchCatalogItems(params = {}) {
  const query = buildQuery(params)
  const response = await fetch(`${API_V1_BASE}/items${query}`, {
    method: 'GET',
    headers: buildHeaders(),
  })
  return handleResponse(response)
}

export async function createCatalogItem(payload) {
  return fetchWithAuth(`${API_V1_BASE}/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchInventoryEntries(params = {}) {
  const query = buildQuery(params)
  return fetchWithAuth(`${API_V1_BASE}/inventory${query}`, {
    method: 'GET',
  })
}

export async function createInventoryEntry(payload) {
  return fetchWithAuth(`${API_V1_BASE}/inventory`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateInventoryEntry(entryId, payload, params = {}) {
  const query = buildQuery(params)
  return fetchWithAuth(`${API_V1_BASE}/inventory/${entryId}${query}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteInventoryEntry(entryId, params = {}) {
  const query = buildQuery(params)
  return fetchWithAuth(`${API_V1_BASE}/inventory/${entryId}${query}`, {
    method: 'DELETE',
  })
}

