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

    // GET /api/inventory
    if (urlStr.includes('/inventory') && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => [...inventoryState],
      }
    }

    // GET /api/items
    if (urlStr.includes('/items') && method === 'GET') {
      return {
        ok: true,
        status: 200,
        json: async () => SAMPLE_CATALOG,
      }
    }

    // POST /api/inventory
    if (urlStr.endsWith('/inventory') && method === 'POST') {
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

    // PATCH /api/inventory/:id
    if (urlStr.includes('/inventory/') && method === 'PATCH') {
      const id = Number(urlStr.split('/inventory/')[1])
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

    // DELETE /api/inventory/:id
    if (urlStr.includes('/inventory/') && method === 'DELETE') {
      const id = Number(urlStr.split('/inventory/')[1])
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

  it('adds a new catalog item to household inventory via Add Item modal', async () => {
    const user = userEvent.setup()
    const state = structuredClone(INITIAL_INVENTORY)
    const fetchMock = mockFetchImplementation(state)
    vi.stubGlobal('fetch', fetchMock)

    render(<InventoryPage />)

    await waitFor(() => {
      expect(screen.getByText('Tomatoes')).toBeInTheDocument()
    })

    // Open Add Item modal
    await user.click(screen.getByRole('button', { name: /Add Item/i }))
    const dialog = await screen.findByRole('dialog', { name: /Add Item to Inventory/i })

    // Select "Milk" from catalog list
    const milkOption = await within(dialog).findByRole('option', { name: /Milk/i })
    await user.click(milkOption)

    // Set quantity to 1000 ml
    const qtyInput = within(dialog).getByLabelText('Quantity')
    await user.clear(qtyInput)
    await user.type(qtyInput, '1000')

    // Submit form
    await user.click(within(dialog).getByRole('button', { name: 'Add to Inventory' }))

    // Verify new item card is rendered in the inventory list
    await waitFor(() => {
      expect(screen.getByText('Milk')).toBeInTheDocument()
      expect(screen.getByText('1000 ml')).toBeInTheDocument()
    })
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

