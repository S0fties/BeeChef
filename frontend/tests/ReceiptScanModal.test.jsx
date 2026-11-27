import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReceiptScanModal from '../src/components/inventory/ReceiptScanModal.jsx'

const RECEIPT_ID = 'r-123'

const CATALOG = [
  { id: 13001, name: 'Banana', item_type: 'ingredient', default_unit: 'piece' },
  { id: 41001, name: 'Milk', item_type: 'ingredient', default_unit: 'ml' },
  { id: 99001, name: 'Bananas', item_type: 'ingredient', default_unit: 'piece' },
  { id: 91004, name: 'Turkish Coffee Pot', item_type: 'appliance', default_unit: null },
]

const CANDIDATES = [
  {
    candidate_id: 0,
    raw_text: '3x ORGANIC BANANAS',
    extracted_name: 'Bananas',
    quantity: 3,
    unit: 'piece',
    matched_item_id: 13001,
    matched_item_name: 'Banana',
  },
  {
    candidate_id: 1,
    raw_text: 'MILK 1 GAL',
    extracted_name: 'Milk',
    quantity: 3.785,
    unit: 'l',
    matched_item_id: 41001,
    matched_item_name: 'Milk',
  },
  {
    candidate_id: 2,
    raw_text: 'KOMBUCHA 16 FL OZ',
    extracted_name: 'Kombucha',
    quantity: 473.176,
    unit: 'ml',
    matched_item_id: null,
    matched_item_name: null,
  },
]

const reply = (status, body = null) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

/**
 * Installs a fetch mock that routes by endpoint. Each option is a list of responses
 * returned in order (the last one repeats). Every request is recorded in `calls`.
 */
function mockApi({
  catalog = [reply(200, CATALOG)],
  upload = [reply(201, { receipt_id: RECEIPT_ID, expires_in_seconds: 3600 })],
  scan = [reply(200, { candidates: CANDIDATES })],
  confirm = [reply(200, { added_count: 1, entries: [] })],
  discard = [reply(204)],
} = {}) {
  const queues = { catalog, upload, scan, confirm, discard }
  const calls = []
  const next = (name) => (queues[name].length > 1 ? queues[name].shift() : queues[name][0])

  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = String(url)
    const method = options.method || 'GET'
    let route
    if (path.includes('/api/v1/items')) route = 'catalog'
    else if (path.endsWith('/scan')) route = 'scan'
    else if (path.endsWith('/confirm')) route = 'confirm'
    else if (method === 'DELETE') route = 'discard'
    else if (path.endsWith('/api/v1/receipts') && method === 'POST') route = 'upload'
    else throw new Error(`Unexpected request: ${method} ${path}`)
    calls.push({ route, path, method, body: options.body })
    return next(route)
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, count: (route) => calls.filter((c) => c.route === route).length }
}

const receiptFile = () =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'receipt.png', { type: 'image/png' })

function renderModal(props = {}) {
  const onClose = vi.fn()
  const onItemsAdded = vi.fn()
  const user = userEvent.setup()
  render(<ReceiptScanModal onClose={onClose} onItemsAdded={onItemsAdded} {...props} />)
  return { user, onClose, onItemsAdded }
}

async function uploadAndScan(user) {
  await user.upload(screen.getByLabelText('Receipt image'), receiptFile())
  await user.click(screen.getByRole('button', { name: 'Scan Receipt' }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ReceiptScanModal', () => {
  describe('step 1: choosing an image (E1)', () => {
    it('rejects a file that is not an image without contacting the server', async () => {
      const api = mockApi()
      renderModal()

      fireEvent.change(screen.getByLabelText('Receipt image'), {
        target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
      })

      expect(screen.getByRole('alert')).toHaveTextContent('Only JPEG, PNG or WebP images')
      expect(screen.getByRole('button', { name: 'Scan Receipt' })).toBeDisabled()
      expect(api.count('upload')).toBe(0)
    })

    it('rejects an image larger than 10 MB', () => {
      mockApi()
      renderModal()
      const big = receiptFile()
      Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })

      fireEvent.change(screen.getByLabelText('Receipt image'), { target: { files: [big] } })

      expect(screen.getByRole('alert')).toHaveTextContent('larger than 10 MB')
      expect(screen.getByRole('button', { name: 'Scan Receipt' })).toBeDisabled()
    })

    it('shows the server message when the upload is rejected', async () => {
      const api = mockApi({
        upload: [reply(400, { detail: 'The file is not a valid JPEG, PNG or WebP image and cannot be processed.' })],
      })
      const { user } = renderModal()

      await uploadAndScan(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('cannot be processed')
      expect(screen.getByRole('button', { name: 'Scan Receipt' })).toBeEnabled()
      expect(api.count('scan')).toBe(0)
    })
  })

  describe('steps 2-4: reviewing candidates', () => {
    it('shows matched lines ticked and unmatched lines locked', async () => {
      mockApi()
      const { user } = renderModal()

      await uploadAndScan(user)

      expect(await screen.findByDisplayValue('Banana')).toBeInTheDocument()
      expect(screen.getByLabelText('Add 3x ORGANIC BANANAS')).toBeChecked()
      expect(screen.getByLabelText('Add MILK 1 GAL')).toBeChecked()
      const kombucha = screen.getByLabelText('Add KOMBUCHA 16 FL OZ')
      expect(kombucha).not.toBeChecked()
      expect(kombucha).toBeDisabled()
      expect(screen.getByText(/Read as "Kombucha"/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Add 2 items' })).toBeInTheDocument()
    })

    it('offers only ingredients, without duplicate names, in the catalog search', async () => {
      const api = mockApi()
      const { user } = renderModal()

      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      const catalogCall = api.calls.find((c) => c.route === 'catalog')
      expect(catalogCall.path).toContain('item_type=ingredient')
      const options = [...document.querySelectorAll('#receipt-catalog-items option')].map(
        (option) => option.value,
      )
      expect(options).toEqual(['Banana', 'Milk'])
    })

    it('links an unmatched line when the user picks a catalog item (singular or plural)', async () => {
      const api = mockApi()
      const { user } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.click(screen.getByLabelText('Discard 3x ORGANIC BANANAS'))
      await user.click(screen.getByLabelText('Discard MILK 1 GAL'))
      await user.type(screen.getByLabelText('Catalog item for KOMBUCHA 16 FL OZ'), 'bananas')

      expect(screen.getByLabelText('Add KOMBUCHA 16 FL OZ')).toBeChecked()
      await user.selectOptions(screen.getByLabelText('Unit for KOMBUCHA 16 FL OZ'), 'piece')
      await user.clear(screen.getByLabelText('Quantity for KOMBUCHA 16 FL OZ'))
      await user.type(screen.getByLabelText('Quantity for KOMBUCHA 16 FL OZ'), '2')
      await user.click(screen.getByRole('button', { name: 'Add 1 item' }))

      await screen.findByText('Added 1 item to your inventory.')
      const body = JSON.parse(api.calls.find((c) => c.route === 'confirm').body)
      expect(body.items).toEqual([{ item_id: 13001, quantity: 2, unit: 'piece', location: null }])
    })
  })

  describe('step 6: confirming', () => {
    it('adds only the selected catalog items after one is discarded (A1)', async () => {
      const api = mockApi()
      const { user, onItemsAdded } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.click(screen.getByLabelText('Discard MILK 1 GAL'))
      await user.click(screen.getByRole('button', { name: 'Add 1 item' }))

      expect(await screen.findByText('Added 1 item to your inventory.')).toBeInTheDocument()
      const confirmCall = api.calls.find((c) => c.route === 'confirm')
      expect(confirmCall.path).toContain(`/api/v1/receipts/${RECEIPT_ID}/confirm`)
      expect(JSON.parse(confirmCall.body).items).toEqual([
        { item_id: 13001, quantity: 3, unit: 'piece', location: null },
      ])
      expect(onItemsAdded).toHaveBeenCalledTimes(1)
      expect(api.count('discard')).toBe(0) // the server deletes the receipt on confirm
    })

    it('discards the receipt and changes nothing when no item is selected (A2)', async () => {
      const api = mockApi()
      const { user, onItemsAdded } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.click(screen.getByLabelText('Add 3x ORGANIC BANANAS'))
      await user.click(screen.getByLabelText('Add MILK 1 GAL'))
      await user.click(screen.getByRole('button', { name: 'Finish without adding' }))

      expect(await screen.findByText(/Your inventory is unchanged/)).toBeInTheDocument()
      expect(api.count('confirm')).toBe(0)
      await waitFor(() => expect(api.count('discard')).toBe(1))
      expect(onItemsAdded).not.toHaveBeenCalled()
    })

    it('requires a unit before adding a weight or volume amount', async () => {
      const api = mockApi()
      const { user } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.selectOptions(screen.getByLabelText('Unit for MILK 1 GAL'), '')
      await user.click(screen.getByRole('button', { name: 'Add 2 items' }))

      expect(screen.getByRole('alert')).toHaveTextContent('Choose a unit for the amount of "Milk"')
      expect(api.count('confirm')).toBe(0)
    })

    it('reports a failed update and keeps the edits for a retry (E3)', async () => {
      mockApi({
        confirm: [reply(409, { detail: "'Milk' is stored in 'pack'. No receipt items were added." })],
      })
      const { user, onItemsAdded } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.click(screen.getByRole('button', { name: 'Add 2 items' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Inventory was not updated')
      expect(screen.getByDisplayValue('Banana')).toBeInTheDocument()
      expect(screen.queryByText(/Added \d+ item/)).not.toBeInTheDocument()
      expect(onItemsAdded).not.toHaveBeenCalled()
    })
  })

  describe('E2: scanning service failure', () => {
    it('lets the user retry with the stored receipt, without uploading again', async () => {
      const api = mockApi({
        scan: [
          reply(502, { detail: 'Receipt extraction could not be completed.' }),
          reply(200, { candidates: CANDIDATES }),
        ],
      })
      const { user } = renderModal()

      await uploadAndScan(user)
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be completed')

      await user.click(screen.getByRole('button', { name: 'Try again' }))

      expect(await screen.findByDisplayValue('Banana')).toBeInTheDocument()
      expect(api.count('upload')).toBe(1)
      expect(api.count('scan')).toBe(2)
    })
  })

  describe('leaving the flow', () => {
    it('deletes the stored receipt when the window is closed', async () => {
      const api = mockApi()
      const { user, onClose } = renderModal()
      await uploadAndScan(user)
      await screen.findByDisplayValue('Banana')

      await user.click(screen.getByRole('button', { name: 'Close' }))

      expect(onClose).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(api.count('discard')).toBe(1))
      const discardCall = api.calls.find((c) => c.route === 'discard')
      expect(discardCall.path).toContain(`/api/v1/receipts/${RECEIPT_ID}`)
    })
  })
})
