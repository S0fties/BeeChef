import { getApplianceImageUrl, getMealDbImageUrl } from '../api/inventory.js'

export const DIFFICULTY_TONES = {
  easy: {
    badge: 'border-[#cfe0c9] bg-[#e7f4ea] text-[#266838]',
  },
  medium: {
    badge: 'border-[#ecd9a8] bg-[#fdf1d8] text-[#8a5a00]',
  },
  hard: {
    badge: 'border-[#f5c2c0] bg-[#fdecea] text-[#b42318]',
  },
  default: {
    badge: 'border-[#e2e8dc] bg-[#f7f9f4] text-[#5d6659]',
  },
}

export const SOURCE_TONES = {
  ai: 'border-[#cfe0c9] bg-[#edf2e8] text-[#36583b]',
  author: 'border-[#e2e8dc] bg-[#f7f9f4] text-[#2e4433]',
  personal: 'border-[#d8e4f2] bg-[#eef5fc] text-[#24527a]',
  community: 'border-[#ecd9a8] bg-[#fffaf0] text-[#8a5a00]',
  default: 'border-[#e2e8dc] bg-[#f7f9f4] text-[#5d6659]',
}

export function resolveRecipeCoverUrl(recipe) {
  const raw =
    recipe?.image_url ??
    recipe?.imageUrl ??
    recipe?.cover_image ??
    recipe?.coverImage ??
    recipe?.photo_url ??
    recipe?.photoUrl ??
    recipe?.thumbnail_url ??
    recipe?.image ??
    null

  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/uploads/')) {
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
    return base ? `${base}${trimmed}` : trimmed
  }

  return trimmed
}

export function formatDurationMinutes(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    return null
  }
  const num = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(num) || num <= 0) return null

  const totalMinutes = Math.round(num)
  if (totalMinutes <= 0) return null

  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} hr`
  return `${hours} hr ${mins} min`
}

function parseDurationField(raw) {
  if (raw === null || raw === undefined || typeof raw === 'boolean') {
    return { numeric: null, label: null }
  }
  if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+(?:\.\d+)?$/.test(raw.trim()))) {
    const num = Number(String(raw).trim())
    const label = formatDurationMinutes(num)
    return {
      numeric: Number.isFinite(num) && num > 0 ? num : null,
      label,
    }
  }
  if (typeof raw === 'string' && raw.trim()) {
    return { numeric: null, label: raw.trim() }
  }
  return { numeric: null, label: null }
}

export function formatRecipeTime(recipe) {
  const prep = parseDurationField(
    recipe?.prep_time_minutes ??
      recipe?.prepTimeMinutes ??
      recipe?.prep_time ??
      recipe?.prepTime,
  )
  const cook = parseDurationField(
    recipe?.cook_time_minutes ??
      recipe?.cookTimeMinutes ??
      recipe?.cook_time ??
      recipe?.cookTime ??
      recipe?.cooking_time ??
      recipe?.cookingTime,
  )
  const total = parseDurationField(
    recipe?.total_time_minutes ??
      recipe?.totalTimeMinutes ??
      recipe?.time_minutes ??
      recipe?.timeMinutes ??
      recipe?.total_time ??
      recipe?.totalTime ??
      recipe?.duration,
  )

  if (total.label) {
    return {
      label: total.label,
      isFallback: false,
      prepLabel: prep.label,
      cookLabel: cook.label,
    }
  }

  if (prep.numeric || cook.numeric) {
    const summedLabel = formatDurationMinutes((prep.numeric || 0) + (cook.numeric || 0))
    if (summedLabel) {
      return {
        label: summedLabel,
        isFallback: false,
        prepLabel: prep.label,
        cookLabel: cook.label,
      }
    }
  }

  if (cook.label || prep.label) {
    return {
      label: cook.label || prep.label,
      isFallback: false,
      prepLabel: prep.label,
      cookLabel: cook.label,
    }
  }

  return {
    label: 'No time listed',
    isFallback: true,
    prepLabel: null,
    cookLabel: null,
  }
}

export function formatServings(recipe) {
  const raw = recipe?.servings ?? recipe?.portions ?? recipe?.yield

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const rounded = Number.isInteger(raw) ? raw : Number(raw.toFixed(1))
    return {
      label: rounded === 1 ? '1 serving' : `${rounded} servings`,
      isFallback: false,
    }
  }

  if (typeof raw === 'string' && raw.trim()) {
    const trimmed = raw.trim()
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed)
      if (Number.isFinite(num) && num > 0) {
        return {
          label: num === 1 ? '1 serving' : `${num} servings`,
          isFallback: false,
        }
      }
      return { label: 'Servings N/A', isFallback: true }
    }
    return {
      label: /serving|portion/i.test(trimmed) ? trimmed : `${trimmed} servings`,
      isFallback: false,
    }
  }

  return { label: 'Servings N/A', isFallback: true }
}

export function normalizeDifficulty(rawDifficulty) {
  if (typeof rawDifficulty !== 'string' || !rawDifficulty.trim()) {
    return { key: 'default', label: 'All levels', isFallback: true }
  }

  const trimmed = rawDifficulty.trim()
  const lower = trimmed.toLowerCase()

  let key = 'default'
  if (['easy', 'beginner', 'simple'].includes(lower)) {
    key = 'easy'
  } else if (['medium', 'moderate', 'intermediate'].includes(lower)) {
    key = 'medium'
  } else if (['hard', 'difficult', 'advanced', 'challenging'].includes(lower)) {
    key = 'hard'
  }

  const label = trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return { key, label, isFallback: false }
}

export function resolveAuthorOrSource(recipe) {
  const sourceCandidate = recipe?.source ?? recipe?.source_type
  const rawSource = typeof sourceCandidate === 'string' ? sourceCandidate.trim() : ''
  const lowerSource = rawSource.toLowerCase()
  const sourceLabel =
    typeof recipe?.source_label === 'string' && recipe.source_label.trim()
      ? recipe.source_label.trim()
      : null

  if (
    recipe?.is_ai_generated === true ||
    ['ai', 'generated', 'ai_generated'].includes(lowerSource)
  ) {
    return {
      kind: 'ai',
      label: sourceLabel || 'AI Suggestion',
      fullName: null,
    }
  }

  const authorObj = recipe?.author ?? recipe?.user ?? recipe?.created_by ?? null
  const authorUsername =
    typeof recipe?.author_username === 'string' && recipe.author_username.trim()
      ? recipe.author_username.trim()
      : null
  const authorName =
    typeof recipe?.author_name === 'string' && recipe.author_name.trim()
      ? recipe.author_name.trim()
      : null

  if (authorObj && typeof authorObj === 'object') {
    const rawHandle = authorObj.user_name ?? authorObj.username
    const handle = typeof rawHandle === 'string' ? rawHandle.trim() : ''
    const fullName =
      [authorObj.name, authorObj.surname]
        .filter((part) => typeof part === 'string' && part.trim())
        .map((part) => part.trim())
        .join(' ') || null

    if (handle) {
      return {
        kind: 'author',
        label: `@${handle.replace(/^@/, '')}`,
        fullName,
      }
    }
    if (fullName) {
      return {
        kind: 'author',
        label: fullName,
        fullName: null,
      }
    }
  }

  if (typeof authorObj === 'string' && authorObj.trim()) {
    return {
      kind: 'author',
      label: authorObj.trim(),
      fullName: null,
    }
  }

  if (authorUsername) {
    return {
      kind: 'author',
      label: `@${authorUsername.replace(/^@/, '')}`,
      fullName: authorName,
    }
  }

  if (authorName) {
    return {
      kind: 'author',
      label: authorName,
      fullName: null,
    }
  }

  if (['personal', 'own', 'custom', 'user'].includes(lowerSource)) {
    return {
      kind: 'personal',
      label: sourceLabel || 'Personal Recipe',
      fullName: null,
    }
  }

  if (sourceLabel || rawSource) {
    return {
      kind: 'community',
      label: sourceLabel || rawSource,
      fullName: null,
    }
  }

  return {
    kind: 'default',
    label: 'BeeChef Recipe',
    fullName: null,
  }
}

export function normalizeIngredients(rawIngredients) {
  if (!Array.isArray(rawIngredients)) return []

  const normalized = []
  rawIngredients.forEach((entry, idx) => {
    if (!entry) return

    if (typeof entry === 'string') {
      const name = entry.trim()
      if (!name) return
      normalized.push({
        key: `ing-${idx}-${name}`,
        name,
        quantityLabel: '',
        imageUrl: null,
        availability: null,
        notes: null,
        optional: false,
      })
      return
    }

    if (typeof entry === 'object') {
      const rawName = entry.name ?? entry.item_name ?? entry.item?.name ?? ''
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      if (!name) return

      const qty = entry.quantity ?? entry.amount
      const hasQty =
        qty !== null &&
        qty !== undefined &&
        qty !== '' &&
        !(typeof qty === 'number' && Number.isNaN(qty))
      const rawUnit = entry.unit ?? entry.item?.default_unit ?? ''
      const unit = typeof rawUnit === 'string' ? rawUnit.trim() : ''

      let quantityLabel = ''
      if (hasQty) {
        quantityLabel = unit ? `${qty} ${unit}` : `${qty}`
      } else if (unit) {
        quantityLabel = unit
      }

      const explicitImage =
        typeof entry.image_url === 'string' && entry.image_url.trim()
          ? entry.image_url.trim()
          : null
      const imageUrl = explicitImage || getMealDbImageUrl(name, 'small')

      let availability = null
      if (typeof entry.is_available === 'boolean') {
        availability = entry.is_available
      } else if (typeof entry.in_stock === 'boolean') {
        availability = entry.in_stock
      }

      const rawNotes = entry.notes ?? entry.preparation ?? ''
      const notes = typeof rawNotes === 'string' && rawNotes.trim() ? rawNotes.trim() : null

      const key =
        entry.id !== undefined && entry.id !== null
          ? `ing-${entry.id}-${idx}`
          : entry.item_id !== undefined && entry.item_id !== null
            ? `ing-item-${entry.item_id}-${idx}`
            : `ing-${idx}-${name}`

      normalized.push({
        key,
        name,
        quantityLabel,
        imageUrl,
        availability,
        notes,
        optional: Boolean(entry.optional),
      })
    }
  })

  return normalized
}

export function normalizeAppliances(recipe) {
  const rawAppliances =
    recipe?.appliances ??
    recipe?.required_appliances ??
    recipe?.requiredAppliances ??
    recipe?.equipment ??
    []

  if (!Array.isArray(rawAppliances)) return []

  const normalized = []
  rawAppliances.forEach((entry, idx) => {
    if (!entry) return

    if (typeof entry === 'string') {
      const name = entry.trim()
      if (!name) return
      normalized.push({
        key: `app-${idx}-${name}`,
        name,
        imageUrl: getApplianceImageUrl(name),
        availability: null,
      })
      return
    }

    if (typeof entry === 'object') {
      const rawName = entry.name ?? entry.item_name ?? entry.item?.name ?? ''
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      if (!name) return

      let availability = null
      if (typeof entry.is_available === 'boolean') {
        availability = entry.is_available
      } else if (typeof entry.in_stock === 'boolean') {
        availability = entry.in_stock
      }

      const explicitImage =
        typeof entry.image_url === 'string' && entry.image_url.trim()
          ? entry.image_url.trim()
          : null
      const imageUrl = explicitImage || getApplianceImageUrl(name)

      const key =
        entry.id !== undefined && entry.id !== null
          ? `app-${entry.id}-${idx}`
          : entry.item_id !== undefined && entry.item_id !== null
            ? `app-item-${entry.item_id}-${idx}`
            : `app-${idx}-${name}`

      normalized.push({
        key,
        name,
        imageUrl,
        availability,
      })
    }
  })

  return normalized
}

function stripStepPrefix(text) {
  return text.replace(/^\s*(?:step\s*\d+\s*[:.-]?|\d+\s*[.):-])\s*/i, '').trim()
}

export function normalizeSteps(recipe) {
  const raw =
    recipe?.steps ??
    recipe?.instructions ??
    recipe?.directions ??
    recipe?.preparation_steps ??
    null

  const collected = []

  if (Array.isArray(raw)) {
    raw.forEach((entry) => {
      if (!entry) return
      if (typeof entry === 'string') {
        const text = stripStepPrefix(entry)
        if (!text) return
        collected.push({ title: null, text, durationLabel: null })
        return
      }
      if (typeof entry === 'object') {
        const rawText =
          entry.instruction ??
          entry.text ??
          entry.description ??
          entry.content ??
          entry.step ??
          ''
        const text = typeof rawText === 'string' ? rawText.trim() : ''
        if (!text) return

        const title =
          typeof entry.title === 'string' && entry.title.trim()
            ? entry.title.trim()
            : null
        const durationLabel = formatDurationMinutes(
          entry.duration_minutes ??
            entry.durationMinutes ??
            entry.time_minutes ??
            entry.duration,
        )
        collected.push({ title, text, durationLabel })
      }
    })
  } else if (typeof raw === 'string') {
    raw
      .split(/\r?\n+/)
      .map((line) => stripStepPrefix(line))
      .filter(Boolean)
      .forEach((text) => {
        collected.push({ title: null, text, durationLabel: null })
      })
  }

  return collected.map((step, idx) => ({
    key: `step-${idx + 1}`,
    stepNumber: idx + 1,
    ...step,
  }))
}

export function normalizeRecipe(recipe = {}) {
  const safe = recipe && typeof recipe === 'object' ? recipe : {}
  const rawTitle = safe.title ?? safe.name ?? ''
  const title = typeof rawTitle === 'string' && rawTitle.trim() ? rawTitle.trim() : 'Untitled Recipe'

  const rawDesc = safe.description ?? safe.summary ?? safe.subtitle ?? ''
  const description = typeof rawDesc === 'string' && rawDesc.trim() ? rawDesc.trim() : null

  const rawTags = Array.isArray(safe.tags)
    ? safe.tags
    : Array.isArray(safe.dietary_tags)
      ? safe.dietary_tags
      : []
  const tags = rawTags
    .filter((tag) => typeof tag === 'string' && tag.trim())
    .map((tag) => tag.trim())

  return {
    id: safe.id ?? null,
    title,
    description,
    coverUrl: resolveRecipeCoverUrl(safe),
    time: formatRecipeTime(safe),
    servings: formatServings(safe),
    difficulty: normalizeDifficulty(safe.difficulty ?? safe.level),
    sourceBadge: resolveAuthorOrSource(safe),
    tags,
    ingredients: normalizeIngredients(
      safe.ingredients ?? safe.ingredient_list ?? safe.items,
    ),
    appliances: normalizeAppliances(safe),
    steps: normalizeSteps(safe),
  }
}
