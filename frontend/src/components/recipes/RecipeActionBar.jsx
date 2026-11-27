import {
  Check,
  Heart,
  Pencil,
  Share2,
  Trash2,
  X,
} from 'lucide-react'

const CUSTOM_ACTION_TONES = {
  primary:
    'border-[#36583b] bg-[#36583b] text-white hover:bg-[#2a462e]',
  danger:
    'border-[#f5c2c0] bg-white text-[#b42318] hover:bg-[#fdf2f2]',
  default:
    'border-[#d8dfd2] bg-white text-[#36583b] hover:bg-[#edf2e8]',
}

function RecipeActionBar({
  recipe,
  recipeTitle,
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
  onEdit,
  deleting = false,
  onDelete,
  actions = [],
}) {
  const hasApprovalStatus =
    approvalStatus === 'approved' || approvalStatus === 'rejected'
  const hasAnyAction =
    Boolean(onToggleFavorite) ||
    Boolean(onApprove) ||
    Boolean(onReject) ||
    Boolean(onPublish) ||
    Boolean(onEdit) ||
    Boolean(onDelete) ||
    hasApprovalStatus ||
    actions.length > 0

  if (!hasAnyAction) return null

  const stopAndRun = (callback) => (event) => {
    event.stopPropagation()
    if (callback) {
      callback(recipe, event)
    }
  }

  return (
    <div
      data-no-expand="true"
      onClick={(event) => event.stopPropagation()}
      className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1ea] bg-[#fbfaf6] px-4 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-2">
        {onApprove && (
          <button
            type="button"
            disabled={approving || rejecting || approvalStatus === 'approved'}
            onClick={stopAndRun(onApprove)}
            aria-label={`Approve ${recipeTitle}`}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              approvalStatus === 'approved'
                ? 'bg-[#266838] text-white'
                : 'bg-[#36583b] text-white hover:bg-[#2a462e]'
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {approving
                ? 'Approving...'
                : approvalStatus === 'approved'
                  ? 'Approved'
                  : 'Approve'}
            </span>
          </button>
        )}

        {onReject && (
          <button
            type="button"
            disabled={rejecting || approving || approvalStatus === 'rejected'}
            onClick={stopAndRun(onReject)}
            aria-label={`Reject ${recipeTitle}`}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              approvalStatus === 'rejected'
                ? 'border-[#b42318] bg-[#fdf2f2] text-[#b42318]'
                : 'border-[#f5c2c0] bg-white text-[#b42318] hover:bg-[#fdf2f2]'
            }`}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {rejecting
                ? 'Rejecting...'
                : approvalStatus === 'rejected'
                  ? 'Rejected'
                  : 'Reject'}
            </span>
          </button>
        )}

        {hasApprovalStatus && !onApprove && !onReject && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              approvalStatus === 'approved'
                ? 'bg-[#e7f4ea] text-[#266838]'
                : 'bg-[#fdecea] text-[#b42318]'
            }`}
          >
            {approvalStatus === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        )}

        {onPublish && (
          <button
            type="button"
            disabled={publishing || isPublished}
            onClick={stopAndRun(onPublish)}
            aria-label={
              isPublished
                ? `${recipeTitle} published to feed`
                : `Publish ${recipeTitle} to feed`
            }
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isPublished
                ? 'border-[#cfe0c9] bg-[#e7f4ea] text-[#266838]'
                : 'border-[#d8dfd2] bg-white text-[#36583b] hover:bg-[#edf2e8]'
            }`}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {publishing
                ? 'Publishing...'
                : isPublished
                  ? 'Published'
                  : 'Publish'}
            </span>
          </button>
        )}

        {actions.map((action) => {
          const ActionIcon = action.icon
          const toneClasses =
            CUSTOM_ACTION_TONES[action.tone] || CUSTOM_ACTION_TONES.default
          return (
            <button
              key={action.key || action.label}
              type="button"
              disabled={Boolean(action.disabled)}
              aria-pressed={
                typeof action.active === 'boolean' ? action.active : undefined
              }
              aria-label={action.ariaLabel || action.label}
              onClick={stopAndRun(action.onClick)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${toneClasses}`}
            >
              {ActionIcon && (
                <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{action.label}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {onToggleFavorite && (
          <button
            type="button"
            disabled={favoritePending}
            aria-pressed={Boolean(isFavorite)}
            aria-label={
              isFavorite
                ? `Remove ${recipeTitle} from favorites`
                : `Save ${recipeTitle} to favorites`
            }
            onClick={stopAndRun(onToggleFavorite)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isFavorite
                ? 'border-[#f5c2c0] bg-[#fdf2f2] text-[#b42318] hover:bg-[#fdecea]'
                : 'border-[#d8dfd2] bg-white text-[#4f5d50] hover:bg-[#f2f4ee]'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        )}

        {onEdit && (
          <button
            type="button"
            onClick={stopAndRun(onEdit)}
            aria-label={`Edit ${recipeTitle}`}
            className="inline-flex items-center gap-1 rounded-xl border border-[#d8dfd2] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4f5d50] transition-colors hover:bg-[#edf2e8] hover:text-[#253b2d]"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            onClick={stopAndRun(onDelete)}
            aria-label={`Remove ${recipeTitle}`}
            className="inline-flex items-center gap-1 rounded-xl border border-[#f5c2c0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#b42318] transition-colors hover:bg-[#fdf2f2] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{deleting ? 'Removing...' : 'Remove'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default RecipeActionBar
