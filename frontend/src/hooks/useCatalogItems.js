import { useEffect, useState } from 'react'
import { fetchCatalogItems } from '../api/inventory.js'

/** Loads the shared item catalog once. Returns { items, setItems, loading, error }. */
export function useCatalogItems(limit = 1000) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchCatalogItems({ limit })
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load catalog items')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  return { items, setItems, loading, error }
}