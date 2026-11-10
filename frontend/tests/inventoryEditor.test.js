import { describe, expect, it } from 'vitest'
import {
  applyDraft,
  buildInventoryChanges,
  decrementState,
  getEffectiveState,
  getQuantityStep,
  groupCatalog,
  incrementState,
  setQuantityState,
} from '../src/utils/inventoryEditor.js'

const MILK = { id: 41001, name: 'Milk', item_type: 'ingredient', category: 'DAIRY_BREAKFAST', subcategory: 'MILK_YOGURT', default_unit: 'ml' }
const LEMON = { id: 11001, name: 'Lemon', item_type: 'ingredient', category: 'FRUIT', subcategory: 'CITRUS', default_unit: 'piece' }
const ORANGE = { id: 11002, name: 'Orange', item_type: 'ingredient', category: 'FRUIT', subcategory: 'CITRUS', default_unit: 'piece' }
const APPLE = { id: 12001, name: 'Apples', item_type: 'ingredient', category: 'FRUIT', subcategory: 'TREE_FRUIT', default_unit: 'piece' }
const OVEN = { id: 82001, name: 'Oven', item_type: 'appliance', category: 'COOKING_APPLIANCE', subcategory: 'MAJOR_APPLIANCE', default_unit: null }

describe('inventoryEditor helpers', () => {
  it('uses unit-based quantity steps', () => {
    expect(getQuantityStep('g')).toBe(100)
    expect(getQuantityStep('ml')).toBe(100)
    expect(getQuantityStep('kg')).toBe(0.5)
    expect(getQuantityStep('piece')).toBe(1)
  })

  it('increments, decrements and never goes below zero', () => {
    const empty = getEffectiveState(LEMON, null, undefined)
    expect(empty).toEqual({ quantity: 0, is_available: false })
    const one = incrementState(LEMON, null, empty)
    expect(one).toEqual({ quantity: 1, is_available: true })
    expect(decrementState(LEMON, null, one)).toEqual({ quantity: 0, is_available: false })
    expect(decrementState(LEMON, null, { quantity: 0, is_available: false }).quantity).toBe(0)
  })

  it('marks quick-tracked (quantity-less) items out of stock on decrement', () => {
    const entry = { id: 5, item_id: LEMON.id, quantity: null, is_available: true, unit: null }
    expect(decrementState(LEMON, entry, getEffectiveState(LEMON, entry))).toEqual({
      quantity: null,
      is_available: false,
    })
  })

  it('parses typed quantities safely', () => {
    expect(setQuantityState('2.5')).toEqual({ quantity: 2.5, is_available: true })
    expect(setQuantityState('')).toEqual({ quantity: 0, is_available: false })
    expect(setQuantityState('-3')).toEqual({ quantity: 0, is_available: false })
  })

  it('drops drafts that return to the original value', () => {
    const entry = { id: 1, item_id: MILK.id, quantity: 500, is_available: true, unit: 'ml' }
    let drafts = applyDraft({}, MILK, entry, { quantity: 600, is_available: true })
    expect(drafts[MILK.id]).toBeDefined()
    drafts = applyDraft(drafts, MILK, entry, { quantity: 500, is_available: true })
    expect(drafts).toEqual({})
    expect(applyDraft({}, LEMON, null, { quantity: 0, is_available: false })).toEqual({})
  })

  it('builds create and update operations from drafts', () => {
    const entries = [
      { id: 1, item_id: MILK.id, quantity: 500, is_available: true, unit: 'ml', item: MILK },
    ]
    const catalogById = new Map([[LEMON.id, LEMON], [OVEN.id, OVEN], [MILK.id, MILK]])
    const drafts = {
      [MILK.id]: { quantity: 0, is_available: false },
      [LEMON.id]: { quantity: 3, is_available: true },
      [OVEN.id]: { quantity: null, is_available: true },
    }
    const { creates, updates } = buildInventoryChanges(entries, drafts, catalogById)
    expect(updates).toEqual([{ id: 1, payload: { quantity: 0, is_available: false } }])
    expect(creates).toEqual(
      expect.arrayContaining([
        { item_id: LEMON.id, quantity: 3, unit: 'piece', is_available: true, location: 'counter' },
        { item_id: OVEN.id, quantity: null, unit: null, is_available: true, location: 'counter' },
      ]),
    )
  })

  it('groups catalog by category and subcategory with in-stock items first', () => {
    const groups = groupCatalog(
      [APPLE, ORANGE, LEMON, MILK],
      [{ value: 'FRUIT' }, { value: 'DAIRY_BREAKFAST' }, { value: 'MEAT' }],
      new Set([ORANGE.id]),
    )
    expect(groups.map((g) => g.category)).toEqual(['FRUIT', 'DAIRY_BREAKFAST'])
    expect(groups[0].total).toBe(3)
    expect(groups[0].subcategories.map((s) => s.subcategory)).toEqual(['CITRUS', 'TREE_FRUIT'])
    expect(groups[0].subcategories[0].items.map((i) => i.name)).toEqual(['Orange', 'Lemon'])
  })
})

