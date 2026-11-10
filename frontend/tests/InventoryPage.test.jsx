import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InventoryPage from '../src/pages/InventoryPage.jsx'

const SAMPLE_CATALOG = [
  {
    id: 23001,
    name: 'Tomatoes',
    item_type: 'ingredient',
    category: 'VEGETABLE',
    subcategory: 'FRUITING_VEGETABLES',
    default_unit: 'g',
    created_at: '2026-11-01T10:00:00Z',
  },
  {
    id: 41001,
    name: 'Milk',
    item_type: 'ingredient',
    category: 'DAIRY_BREAKFAST',
    subcategory: 'MILK_YOGURT',
    default_unit: 'ml',
    created_at: '2026-11-01T10:00:00Z',
  },
  {
    id: 81001,
    name: 'Air Fryer',
    item_type: 'appliance',
    category: 'COOKING_APPLIANCE',
    subcategory: 'ELECTRIC_COOKER',
    default_unit: null,
    created_at: '2026-11-01T10:00:00Z',
  },
]

const INITIAL_INVENTORY = [
  {
    id: 1,
    household_id: 10,
    item_id: 23001,
    is_available: true,
    quantity: 500,
    unit: 'g',
    location: 'fridge',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    item: SAMPLE_CATALOG[0],
  },
  {
    id: 2,
    household_id: 10,
    item_id: 81001,
    is_available: true,
    quantity: null,
    unit: null,
    location: 'counter',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    item: SAMPLE_CATALOG[2],
  },
]

function mockFetchImplementation(inventoryState) {
  return vi.fn(async (url, options = {}) => {
    const method = (options.method || 'GET').toUpperCase()
    const urlStr = String(url)

    // GET /api/v1/inventory
    if (urlStr.includes('/api/v1/inventory') && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => [...inventoryState],
      }
    }

    // GET /api/v1/items
    if (urlStr.includes('/api/v1/items') && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => SAMPLE_CATALOG,
      }
    }

    // POST /api/v1/inventory
    if (urlStr.endsWith('/api/v1/inventory') && method === 'POST') {
      const body = JSON.parse(options.body)
      const catalogItem = SAMPLE_CATALOG.find((c) => c.id === body.item_id)
      const created = {
        id: 99,
        household_id: 10,
        item_id: body.item_id,
        is_available: body.is_available,
        quantity: body.quantity,
        unit: body.unit,
        location: body.location,
        created_at: '2026-11-02T10:00:00Z',
        updated_at: '2026-11-02T10:00:00Z',
        item: catalogItem,
      }
      inventoryState.push(created)
      return {
        ok: true,
        status: 201,
        json: async () => created,
      }
    }

    // PATCH /api/v1/inventory/:id
    if (urlStr.includes('/api/v1/inventory/') && method === 'PATCH') {
      const id = Number(urlStr.split('/api/v1/inventory/')[1])
      const body = JSON.parse(options.body)
      const idx = inventoryState.findIndex((e) => e.id === id)
      const updated = {
        ...inventoryState[idx],
        ...body,
      }
      inventoryState[idx] = updated
      return {
        ok: true,
        status: 200,
        json: async () => updated,
      }
    }

    // DELETE /api/v1/inventory/:id
    if (urlStr.includes('/api/v1/inventory/') && method === 'DELETE') {
      const id = Number(urlStr.split('/api/v1/inventory/')[1])
      const idx = inventoryState.findIndex((e) => e.id === id)
      if (idx !== -1) inventoryState.splice(idx, 1)
      return {
        ok: true,
        status: 204,
        json: async () => null,
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => ([]),
    }
  })
}

describe('InventoryPage UI and API integration', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'fake-jwt-token')
  })

  it('renders existing inventory items and filters by type, search, and location', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    vi.stubGlobal('fetch', mockFetchImplementation(state))

    render(<InventoryPage />)

    // Wait for initial inventory items to appear
    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
      expect(screen.getByText('Air Fryer')).toBeInTheDocument()
    })

    // Filter by Appliances tab
    await user.click(screen.getByRole('tab', { name: 'Appliances' }))
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument()
    expect(screen.getByText('Air Fryer')).toBeInTheDocument()

    // Back to All Items tab
    await user.click(screen.getByRole('tab', { name: 'All Items' }))
    expect(screen.getByText('Tomatoes')).toBeInTheDocument()

    // Filter by search input
    const searchInput = screen.getByLabelText('Search inventory items')
    await user.type(searchInput, 'tom')
    expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    expect(screen.queryByText('Air Fryer')).not.toBeInTheDocument()

    await user.clear(searchInput)

    // Filter by storage location pill
    await user.click(screen.getByRole('button', { name: 'Counter' }))
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument()
    expect(screen.getByText('Air Fryer')).toBeInTheDocument()
  })

  it('shows a quiet out-of-stock note only when something has run out', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    vi.stubGlobal('fetch', mockFetchImplementation(state))

    render(<InventoryPage />)
    await waitFor(() => {
      expect(screen.getByText('Air Fryer')).toBeInTheDocument()
    })
    // No stats dashboard and no note while everything is in stock
    expect(screen.queryByText('Total Items')).not.toBeInTheDocument()
    expect(screen.queryByTestId('out-of-stock-note')).not.toBeInTheDocument()

    // Running out of an item makes the note appear
    await user.click(screen.getByRole('button', { name: 'Toggle Air Fryer availability' }))
    await waitFor(() => {
      const note = screen.getByTestId('out-of-stock-note')
      expect(note).toHaveTextContent('Out of stock')
      expect(note).toHaveTextContent('Air Fryer')
      expect(note).toHaveTextContent('1 item')
    })
  })

  it('adds a catalog item through the in-page edit mode with collapsed categories', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    const fetchMock = mockFetchImplementation(state)
    vi.stubGlobal('fetch', fetchMock)

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    })

    // Enter edit mode (no dialog is opened)
    await user.click(screen.getByRole('button', { name: /Edit Inventory/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Categories are collapsed by default
    const dairyHeader = await screen.findByRole('button', { name: /Dairy & Breakfast/i })
    expect(dairyHeader).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Milk')).not.toBeInTheDocument()

    // Expand Dairy and bump Milk twice (+100 ml step)
    await user.click(dairyHeader)
    expect(dairyHeader).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Increase Milk' }))
    await user.click(screen.getByRole('button', { name: 'Increase Milk' }))
    expect(screen.getByLabelText('Milk quantity')).toHaveValue(200)
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    // Back to normal view with the new card
    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('200 ml')).toBeInTheDocument()
    })
    const postCall = fetchMock.mock.calls.find(
      ([url, opts]) => String(url).endsWith('/api/v1/inventory') && opts?.method === 'POST',
    )
    expect(JSON.parse(postCall[1].body)).toMatchObject({
      item_id: 41001,
      quantity: 200,
      unit: 'ml',
      is_available: true,
      location: 'fridge',
    })
  })

  it('updates existing stock in edit mode and lets search auto-expand categories', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    const fetchMock = mockFetchImplementation(state)
    vi.stubGlobal('fetch', fetchMock)

    render(<InventoryPage />)
    await waitFor(() => {
      expect(screen.getByText('500 g')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Edit Inventory/i }))
    await user.type(await screen.findByLabelText('Search catalog'), 'tom')

    // Matching category opens automatically while searching
    const qtyInput = await screen.findByLabelText('Tomatoes quantity')
    expect(qtyInput).toHaveValue(500)
    await user.click(screen.getByRole('button', { name: 'Decrease Tomatoes' }))
    expect(qtyInput).toHaveValue(400)

    // Appliance toggle (search for it)
    await user.clear(screen.getByLabelText('Search catalog'))
    await user.type(screen.getByLabelText('Search catalog'), 'air')
    const toggle = await screen.findByRole('switch', { name: 'Toggle Air Fryer' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getByText('400 g')).toBeInTheDocument()
    })
    const patchBodies = fetchMock.mock.calls
      .filter(([, opts]) => opts?.method === 'PATCH')
      .map(([url, opts]) => [String(url), JSON.parse(opts.body)])
    expect(patchBodies).toEqual(
      expect.arrayContaining([
        [expect.stringContaining('/api/v1/inventory/1'), { quantity: 400, is_available: true }],
        [expect.stringContaining('/api/v1/inventory/2'), { quantity: null, is_available: false }],
      ]),
    )
  })

  it('keeps only one category expanded at a time in edit mode', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', mockFetchImplementation(structuredClone(INITIAL_INVENTORY)))

    render(<InventoryPage />)
    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Edit Inventory/i }))

    const vegHeader = await screen.findByRole('button', { name: /Vegetable/i })
    const dairyHeader = screen.getByRole('button', { name: /Dairy & Breakfast/i })

    await user.click(vegHeader)
    expect(vegHeader).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Tomatoes quantity')).toBeInTheDocument()

    // Opening another category collapses the previous one
    await user.click(dairyHeader)
    expect(dairyHeader).toHaveAttribute('aria-expanded', 'true')
    expect(vegHeader).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByLabelText('Tomatoes quantity')).not.toBeInTheDocument()

    // Clicking the open category again collapses it
    await user.click(dairyHeader)
    expect(dairyHeader).toHaveAttribute('aria-expanded', 'false')
  })

  it('discards staged edit-mode changes without calling the API', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    const fetchMock = mockFetchImplementation(state)
    vi.stubGlobal('fetch', fetchMock)

    render(<InventoryPage />)
    await waitFor(() => {
      expect(screen.getByText('500 g')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /Edit Inventory/i }))
    await user.click(await screen.findByRole('button', { name: /Vegetable/i }))
    await user.click(screen.getByRole('button', { name: 'Increase Tomatoes' }))
    expect(screen.getByLabelText('Tomatoes quantity')).toHaveValue(600)

    await user.click(screen.getByRole('button', { name: 'Discard' }))

    expect(screen.getByText('500 g')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(([, opts]) => ['POST', 'PATCH'].includes(opts?.method)),
    ).toBe(false)
  })

  it('edits an existing item via Edit Item modal and updates its display', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    vi.stubGlobal('fetch', mockFetchImplementation(state))

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('500 g')).toBeInTheDocument()
    })

    // Click Edit on Tomatoes
    await user.click(screen.getByRole('button', { name: 'Edit Tomatoes' }))
    const editDialog = await screen.findByRole('dialog', { name: /Edit Tomatoes/i })

    const qtyInput = within(editDialog).getByLabelText('Quantity')
    await user.clear(qtyInput)
    await user.type(qtyInput, '750')

    await user.click(within(editDialog).getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(screen.getByText('750 g')).toBeInTheDocument()
    })
  })

  it('deletes an item via Delete Item confirmation modal', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    vi.stubGlobal('fetch', mockFetchImplementation(state))

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    })

    // Click Delete on Tomatoes
    await user.click(screen.getByRole('button', { name: 'Delete Tomatoes' }))
    const deleteDialog = await screen.findByRole('dialog', { name: /Remove Tomatoes\?/i })

    await user.click(within(deleteDialog).getByRole('button', { name: 'Delete Item' }))

    await waitFor(() => {
      expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument()
    })
  })
})

