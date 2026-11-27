import { describe, expect, it } from 'vitest'
import {
  formatDurationMinutes,
  formatRecipeTime,
  formatServings,
  normalizeAppliances,
  normalizeDifficulty,
  normalizeIngredients,
  normalizeRecipe,
  normalizeSteps,
  resolveAuthorOrSource,
  resolveRecipeCoverUrl,
} from '../src/utils/recipeCard.js'

describe('recipeCard utilities', () => {
  describe('resolveRecipeCoverUrl', () => {
    it('returns the first available non-empty image URL field', () => {
      expect(resolveRecipeCoverUrl({ image_url: ' https://example.com/a.jpg ' })).toBe(
        'https://example.com/a.jpg',
      )
      expect(resolveRecipeCoverUrl({ coverImage: 'https://example.com/b.jpg' })).toBe(
        'https://example.com/b.jpg',
      )
      expect(resolveRecipeCoverUrl({ photo_url: '/uploads/posts/meal.png' })).toBe(
        '/uploads/posts/meal.png',
      )
      expect(resolveRecipeCoverUrl({ thumbnail_url: 'https://example.com/thumb.png' })).toBe(
        'https://example.com/thumb.png',
      )
    })

    it('returns null when cover URL is absent or blank', () => {
      expect(resolveRecipeCoverUrl(null)).toBeNull()
      expect(resolveRecipeCoverUrl({})).toBeNull()
      expect(resolveRecipeCoverUrl({ image_url: '   ' })).toBeNull()
    })
  })

  describe('formatDurationMinutes & formatRecipeTime', () => {
    it('formats positive durations into min and hr labels', () => {
      expect(formatDurationMinutes(25)).toBe('25 min')
      expect(formatDurationMinutes(60)).toBe('1 hr')
      expect(formatDurationMinutes(75)).toBe('1 hr 15 min')
      expect(formatDurationMinutes('45')).toBe('45 min')
      expect(formatDurationMinutes(0)).toBeNull()
      expect(formatDurationMinutes(-10)).toBeNull()
      expect(formatDurationMinutes('abc')).toBeNull()
      expect(formatDurationMinutes(true)).toBeNull()
    })

    it('uses explicit total time, summed prep/cook times, or fallback', () => {
      expect(
        formatRecipeTime({
          prep_time_minutes: 10,
          cook_time_minutes: 20,
          total_time_minutes: 40,
        }),
      ).toEqual({
        label: '40 min',
        isFallback: false,
        prepLabel: '10 min',
        cookLabel: '20 min',
      })

      expect(
        formatRecipeTime({
          prep_time_minutes: 15,
          cook_time_minutes: 45,
        }),
      ).toEqual({
        label: '1 hr',
        isFallback: false,
        prepLabel: '15 min',
        cookLabel: '45 min',
      })

      expect(formatRecipeTime({ cook_time: 'About 20 mins' })).toEqual({
        label: 'About 20 mins',
        isFallback: false,
        prepLabel: null,
        cookLabel: 'About 20 mins',
      })

      expect(formatRecipeTime({})).toEqual({
        label: 'No time listed',
        isFallback: true,
        prepLabel: null,
        cookLabel: null,
      })
    })
  })

  describe('formatServings', () => {
    it('formats singular, plural, string, and fallback servings', () => {
      expect(formatServings({ servings: 1 })).toEqual({
        label: '1 serving',
        isFallback: false,
      })
      expect(formatServings({ portions: 4 })).toEqual({
        label: '4 servings',
        isFallback: false,
      })
      expect(formatServings({ yield: '2 portions' })).toEqual({
        label: '2 portions',
        isFallback: false,
      })
      expect(formatServings({ servings: '6' })).toEqual({
        label: '6 servings',
        isFallback: false,
      })
      expect(formatServings({ servings: 0 })).toEqual({
        label: 'Servings N/A',
        isFallback: true,
      })
      expect(formatServings({})).toEqual({
        label: 'Servings N/A',
        isFallback: true,
      })
    })
  })

  describe('normalizeDifficulty', () => {
    it('maps known difficulty synonyms and provides fallback', () => {
      expect(normalizeDifficulty('easy')).toEqual({
        key: 'easy',
        label: 'Easy',
        isFallback: false,
      })
      expect(normalizeDifficulty('Intermediate')).toEqual({
        key: 'medium',
        label: 'Intermediate',
        isFallback: false,
      })
      expect(normalizeDifficulty('HARD')).toEqual({
        key: 'hard',
        label: 'Hard',
        isFallback: false,
      })
      expect(normalizeDifficulty('chef special')).toEqual({
        key: 'default',
        label: 'Chef Special',
        isFallback: false,
      })
      expect(normalizeDifficulty('')).toEqual({
        key: 'default',
        label: 'All levels',
        isFallback: true,
      })
    })
  })

  describe('resolveAuthorOrSource', () => {
    it('resolves AI, author object, username, personal, community, and fallback badges', () => {
      expect(resolveAuthorOrSource({ is_ai_generated: true })).toEqual({
        kind: 'ai',
        label: 'AI Suggestion',
        fullName: null,
      })
      expect(
        resolveAuthorOrSource({
          author: { user_name: 'maya', name: 'Maya', surname: 'Chef' },
        }),
      ).toEqual({
        kind: 'author',
        label: '@maya',
        fullName: 'Maya Chef',
      })
      expect(
        resolveAuthorOrSource({
          user: { name: 'Deniz', surname: 'Kaya' },
        }),
      ).toEqual({
        kind: 'author',
        label: 'Deniz Kaya',
        fullName: null,
      })
      expect(resolveAuthorOrSource({ author_username: '@omar' })).toEqual({
        kind: 'author',
        label: '@omar',
        fullName: null,
      })
      expect(resolveAuthorOrSource({ source: 'personal' })).toEqual({
        kind: 'personal',
        label: 'Personal Recipe',
        fullName: null,
      })
      expect(resolveAuthorOrSource({ source_label: 'Community Pick' })).toEqual({
        kind: 'community',
        label: 'Community Pick',
        fullName: null,
      })
      expect(resolveAuthorOrSource({})).toEqual({
        kind: 'default',
        label: 'BeeChef Recipe',
        fullName: null,
      })
    })
  })

  describe('normalizeIngredients', () => {
    it('normalizes objects, nested items, and plain strings while skipping blanks', () => {
      const result = normalizeIngredients([
        null,
        '  ',
        '1 tbsp Olive Oil',
        {
          id: 1,
          name: 'Chickpeas',
          quantity: 200,
          unit: 'g',
          is_available: true,
          notes: 'Drained',
        },
        {
          item_id: 42,
          item: { name: 'Garlic', default_unit: 'clove' },
          amount: 2,
          in_stock: false,
          optional: true,
        },
      ])

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        name: '1 tbsp Olive Oil',
        quantityLabel: '',
        availability: null,
      })
      expect(result[1]).toMatchObject({
        name: 'Chickpeas',
        quantityLabel: '200 g',
        availability: true,
        notes: 'Drained',
        optional: false,
      })
      expect(result[2]).toMatchObject({
        name: 'Garlic',
        quantityLabel: '2 clove',
        availability: false,
        optional: true,
      })
    })
  })

  describe('normalizeAppliances', () => {
    it('normalizes required appliances from strings and objects', () => {
      const result = normalizeAppliances({
        required_appliances: [
          'Air Fryer',
          { id: 82001, name: 'Oven', is_available: true },
          { name: '   ' },
        ],
      })

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        name: 'Air Fryer',
        imageUrl: '/images/appliances/air-fryer.svg',
        availability: null,
      })
      expect(result[1]).toMatchObject({
        name: 'Oven',
        imageUrl: '/images/appliances/oven.svg',
        availability: true,
      })
    })
  })

  describe('normalizeSteps', () => {
    it('normalizes array strings, structured step objects, and newline text', () => {
      expect(
        normalizeSteps({
          steps: ['1. Chop onions', '', 'Step 2: Saute until golden'],
        }),
      ).toEqual([
        { key: 'step-1', stepNumber: 1, title: null, text: 'Chop onions', durationLabel: null },
        {
          key: 'step-2',
          stepNumber: 2,
          title: null,
          text: 'Saute until golden',
          durationLabel: null,
        },
      ])

      expect(
        normalizeSteps({
          steps: [
            { title: 'Roast', instruction: 'Bake at 200C', duration_minutes: 25 },
          ],
        }),
      ).toEqual([
        {
          key: 'step-1',
          stepNumber: 1,
          title: 'Roast',
          text: 'Bake at 200C',
          durationLabel: '25 min',
        },
      ])

      expect(
        normalizeSteps({
          instructions: '1) Boil water\n2) Add pasta\n\n3) Simmer 8 minutes',
        }),
      ).toHaveLength(3)

      expect(normalizeSteps({ instructions: '   ' })).toEqual([])
    })
  })

  describe('normalizeRecipe', () => {
    it('returns safe defaults when recipe is null or empty', () => {
      const normalized = normalizeRecipe(null)
      expect(normalized.title).toBe('Untitled Recipe')
      expect(normalized.coverUrl).toBeNull()
      expect(normalized.time.label).toBe('No time listed')
      expect(normalized.servings.label).toBe('Servings N/A')
      expect(normalized.difficulty.label).toBe('All levels')
      expect(normalized.sourceBadge.label).toBe('BeeChef Recipe')
      expect(normalized.ingredients).toEqual([])
      expect(normalized.appliances).toEqual([])
      expect(normalized.steps).toEqual([])
    })
  })
})
