import { useEffect, useId, useRef, useState } from 'react'
import {
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  DIFFICULTY_TONES,
  SOURCE_TONES,
  normalizeRecipe,
} from '../../utils/recipeCard.js'
import RecipeActionBar from './RecipeActionBar.jsx'
import RecipeDetailsContent from './RecipeDetailsContent.jsx'

function RecipeCard({
  recipe,
  expandMode = 'inline',
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  detailsLoading = false,
  detailsError = '',
  onLoadDetails,
  onRetryDetails,
  isFavorite = false,
  favoritePending = false,
  onToggleFavorite,
  approvalStatus = 'idle',
  approving = false,
  rejecting = false,
  onApprove,
  onReject,
  isPublished = false,
  publishing = false,
  onPublish,
  onShare,
  onEdit,
  deleting = false,
  onDelete,
  actions = [],
  className = '',
}) {
  const isControlled = expanded !== undefined
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(
    Boolean(defaultExpanded),
  )
  const isExpanded = isControlled ? Boolean(expanded) : uncontrolledExpanded

  const [failedCoverUrl, setFailedCoverUrl] = useState(null)
  const [asyncLoading, setAsyncLoading] = useState(false)
  const [asyncError, setAsyncError] = useState('')
  const [loadedRecipePatch, setLoadedRecipePatch] = useState(null)

  const triggerRef = useRef(null)
  const detailsRegionId = useId()
  const modalTitleId = useId()

  const mergedRecipe = loadedRecipePatch
    ? { ...(recipe || {}), ...loadedRecipePatch }
    : recipe
  const normalized = normalizeRecipe(mergedRecipe)
  const showCoverImage =
    Boolean(normalized.coverUrl) && failedCoverUrl !== normalized.coverUrl

  const isModalMode = expandMode === 'modal'
  const effectivePublish = onPublish || onShare
  const effectiveLoading = Boolean(detailsLoading || asyncLoading)
  const effectiveError = detailsError || asyncError

  const runLoadDetails = async () => {
    if (!onLoadDetails) return
    setAsyncLoading(true)
    setAsyncError('')
    try {
      const result = await onLoadDetails(recipe)
      if (result && typeof result === 'object') {
        setLoadedRecipePatch(result)
      }
    } catch (err) {
      setAsyncError(err?.message || 'Could not load recipe details.')
    } finally {
      setAsyncLoading(false)
    }
  }

  const handleSetExpanded = (nextExpanded, { restoreFocus = false } = {}) => {
    if (!isControlled) {
      setUncontrolledExpanded(nextExpanded)
    }
    if (onExpandedChange) {
      onExpandedChange(nextExpanded, recipe)
    }
    if (nextExpanded) {
      runLoadDetails()
    } else if (restoreFocus && isModalMode) {
      triggerRef.current?.focus({ preventScroll: true })
    }
  }

  const handleToggleExpand = () => {
    handleSetExpanded(!isExpanded, { restoreFocus: isExpanded })
  }

  const handleRetry = () => {
    if (onRetryDetails) {
      onRetryDetails(recipe)
    }
    if (onLoadDetails) {
      runLoadDetails()
    }
  }

  useEffect(() => {
    if (!isModalMode || !isExpanded) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (!isControlled) {
          setUncontrolledExpanded(false)
        }
        if (onExpandedChange) {
          onExpandedChange(false, recipe)
        }
        triggerRef.current?.focus({ preventScroll: true })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalMode, isExpanded, isControlled, onExpandedChange, recipe])

  const difficultyTone =
    DIFFICULTY_TONES[normalized.difficulty.key] || DIFFICULTY_TONES.default
  const sourceTone =
    SOURCE_TONES[normalized.sourceBadge.kind] || SOURCE_TONES.default

  const actionBarProps = {
    recipe,
    recipeTitle: normalized.title,
    isFavorite,
    favoritePending,
    onToggleFavorite,
    approvalStatus,
    approving,
    rejecting,
    onApprove,
    onReject,
    isPublished,
    publishing,
    onPublish: effectivePublish,
    onEdit,
    deleting,
    onDelete,
    actions,
  }

  const showOuterActionBar = !(isModalMode && isExpanded)

  return (
    <>
      <article
        aria-hidden={isModalMode && isExpanded ? true : undefined}
        data-testid={
          normalized.id !== null
            ? `recipe-card-${normalized.id}`
            : 'recipe-card'
        }
        className={`overflow-hidden rounded-2xl border border-[#e4e8de] bg-white shadow-2xs transition-shadow duration-150 hover:shadow-sm ${className}`}
      >
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isExpanded}
          aria-controls={!isModalMode ? detailsRegionId : undefined}
          onClick={handleToggleExpand}
          className="flex w-full flex-col gap-3.5 p-4 text-left transition-colors hover:bg-[#fbfaf6]/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#36583b] sm:flex-row sm:items-stretch"
        >
          <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl border border-[#eef1ea] bg-[#f7f9f4] sm:h-28 sm:w-32">
            {showCoverImage ? (
              <img
                src={normalized.coverUrl}
                alt={normalized.title}
                onError={() => setFailedCoverUrl(normalized.coverUrl)}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                data-testid="recipe-cover-placeholder"
                className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-[#f4f7ef] px-2 text-center text-[#5f7a61]"
              >
                <ChefHat className="h-7 w-7" aria-hidden="true" />
                <span className="text-[11px] font-medium text-[#697065]">
                  No photo
                </span>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-2.5">
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sourceTone}`}
                >
                  {normalized.sourceBadge.kind === 'ai' ? (
                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <UserRound
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{normalized.sourceBadge.label}</span>
                </span>

                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#36583b]">
                  <span>{isExpanded ? 'Hide details' : 'View details'}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
              </div>

              <h3 className="m-0 line-clamp-2 text-base font-bold leading-snug text-[#253b2d]">
                {normalized.title}
              </h3>

              {normalized.description && (
                <p className="m-0 mt-1 line-clamp-2 text-xs leading-relaxed text-[#697065]">
                  {normalized.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${
                  normalized.time.isFallback
                    ? 'border-[#e2e8dc] bg-[#f7f9f4] text-[#7a8075]'
                    : 'border-[#e2e8dc] bg-[#f7f9f4] text-[#2e4433]'
                }`}
              >
                <Clock className="h-3.5 w-3.5 text-[#5f7a61]" aria-hidden="true" />
                <span>{normalized.time.label}</span>
              </span>

              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold ${difficultyTone.badge}`}
              >
                {normalized.difficulty.label}
              </span>

              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium ${
                  normalized.servings.isFallback
                    ? 'border-[#e2e8dc] bg-[#f7f9f4] text-[#7a8075]'
                    : 'border-[#e2e8dc] bg-[#f7f9f4] text-[#2e4433]'
                }`}
              >
                <Users className="h-3.5 w-3.5 text-[#5f7a61]" aria-hidden="true" />
                <span>{normalized.servings.label}</span>
              </span>
            </div>
          </div>
        </button>

        {!isModalMode && isExpanded && (
          <div
            id={detailsRegionId}
            role="region"
            aria-label={`${normalized.title} details`}
            className="border-t border-[#eef1ea] bg-white p-4"
          >
            <RecipeDetailsContent
              normalized={normalized}
              detailsLoading={effectiveLoading}
              detailsError={effectiveError}
              onRetryDetails={
                onRetryDetails || onLoadDetails ? handleRetry : null
              }
            />

            <div className="mt-4 flex justify-end border-t border-[#eef1ea] pt-3">
              <button
                type="button"
                onClick={() => handleSetExpanded(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#d8dfd2] bg-white px-3 py-1.5 text-xs font-semibold text-[#36583b] transition-colors hover:bg-[#edf2e8]"
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                Collapse details
              </button>
            </div>
          </div>
        )}

        {showOuterActionBar && <RecipeActionBar {...actionBarProps} />}
      </article>

      {isModalMode && isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleSetExpanded(false, { restoreFocus: true })
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-[#eeece4] px-5 py-4">
              <div className="min-w-0 flex-1">
                <span
                  className={`mb-1.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${sourceTone}`}
                >
                  {normalized.sourceBadge.kind === 'ai' ? (
                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <UserRound
                      className="h-3 w-3 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{normalized.sourceBadge.label}</span>
                </span>
                <h2
                  id={modalTitleId}
                  className="m-0 text-lg font-bold text-[#253b2d]"
                >
                  {normalized.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e8dc] bg-[#f7f9f4] px-2.5 py-0.5 font-medium text-[#2e4433]">
                    <Clock
                      className="h-3.5 w-3.5 text-[#5f7a61]"
                      aria-hidden="true"
                    />
                    <span>{normalized.time.label}</span>
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold ${difficultyTone.badge}`}
                  >
                    {normalized.difficulty.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e8dc] bg-[#f7f9f4] px-2.5 py-0.5 font-medium text-[#2e4433]">
                    <Users
                      className="h-3.5 w-3.5 text-[#5f7a61]"
                      aria-hidden="true"
                    />
                    <span>{normalized.servings.label}</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSetExpanded(false, { restoreFocus: true })}
                aria-label="Close recipe details"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#697065] hover:bg-[#f2f4ee] hover:text-[#253b2d]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {showCoverImage && (
                <div className="mb-4 h-48 w-full overflow-hidden rounded-xl border border-[#eef1ea] bg-[#f7f9f4]">
                  <img
                    src={normalized.coverUrl}
                    alt={normalized.title}
                    onError={() => setFailedCoverUrl(normalized.coverUrl)}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              {normalized.description && (
                <p className="m-0 mb-4 text-sm leading-relaxed text-[#4f5d50]">
                  {normalized.description}
                </p>
              )}

              <RecipeDetailsContent
                normalized={normalized}
                detailsLoading={effectiveLoading}
                detailsError={effectiveError}
                onRetryDetails={
                  onRetryDetails || onLoadDetails ? handleRetry : null
                }
              />
            </div>

            <RecipeActionBar {...actionBarProps} />
          </div>
        </div>
      )}
    </>
  )
}

export default RecipeCard
