import { getToken } from '../services/api.js'
import { getStoredToken } from './inventory.js'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const RECEIPTS_BASE = `${API_ORIGIN}/api/v1/receipts`

export const RECEIPT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

// Real login stores "access_token"; the inventory demo session stores "token".
function authHeader() {
  const token = getToken() || getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function parseResponse(response) {
  if (response.status === 204) return null
  const data = await response.json().catch(() => null)
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

export function validateReceiptFile(file) {
  if (!file) return 'Choose a receipt image first.'
  if (!RECEIPT_ACCEPTED_TYPES.includes(file.type)) return 'Only JPEG, PNG or WebP images can be scanned.'
  if (file.size === 0) return 'The selected file is empty.'
  if (file.size > RECEIPT_MAX_BYTES) return 'The image is larger than 10 MB. Try a smaller photo.'
  return ''
}

// Step 1: upload + validate. The server keeps the image until the flow ends.
export async function uploadReceipt(file) {
  const body = new FormData()
  body.append('file', file)
  // No Content-Type header: the browser sets the multipart boundary itself.
  const response = await fetch(RECEIPTS_BASE, { method: 'POST', headers: authHeader(), body })
  return parseResponse(response)
}

// Steps 2-4: extract candidates from the stored receipt. Safe to retry.
export async function scanReceipt(receiptId) {
  const response = await fetch(`${RECEIPTS_BASE}/${receiptId}/scan`, {
    method: 'POST',
    headers: authHeader(),
  })
  return parseResponse(response)
}

// Step 6: add only the confirmed items. The server deletes the receipt on success.
export async function confirmReceipt(receiptId, items) {
  const response = await fetch(`${RECEIPTS_BASE}/${receiptId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ items }),
  })
  return parseResponse(response)
}

// Cancel the flow and delete the stored receipt.
export async function discardReceipt(receiptId) {
  const response = await fetch(`${RECEIPTS_BASE}/${receiptId}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
  if (!response.ok && response.status !== 404) await parseResponse(response)
}
