import { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CookingPot,
  ListOrdered,
  LoaderCircle,
  RefreshCw,
  Utensils,
  XCircle,
} from 'lucide-react'

function RecipeDetailsContent({
  normalized,
  detailsLoading = false,
  detailsError = '',
  onRetryDetails = null,
}) {
  const [failedImageUrls, setFailedImageUrls] = useState(() => new Set())

  const handleImageError = (url) => {
    if (!url) return
    setFailedImageUrls((prev) => {
      if (prev.has(url)) return prev
      const next = new Set(prev)
      next.add(url)
      return next
    })
  }

  const hasTimeBreakdown =
    Boolean(normalized.time.prepLabel) || Boolean(normalized.time.cookLabel)
  const hasMetadataStrip = hasTimeBreakdown || normalized.tags.length > 0

  return (
    <div className="space-y-5">
      {hasMetadataStrip && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#eef1ea] pb-3 text-xs text-[#5d6659]">
          {normalized.time.prepLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e8dc] bg-[#f7f9f4] px-2.5 py-1 font-medium text-[#37473b]">
              <Clock className="h-3.5 w-3.5 text-[#5f7a61]" aria-hidden="true" />
              Prep: {normalized.time.prepLabel}
            </span>
          )}
          {normalized.time.cookLabel && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e2e8dc] bg-[#f7f9f4] px-2.5 py-1 font-medium text-[#37473b]">
              <Clock className="h-3.5 w-3.5 text-[#5f7a61]" aria-hidden="true" />
              Cook: {normalized.time.cookLabel}
            </span>
          )}
          {normalized.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full border border-[#cfe0c9] bg-[#edf2e8] px-2.5 py-1 font-semibold text-[#36583b]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {detailsLoading ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[#e6ebe1] bg-[#fbfaf6] py-10 text-center text-sm font-medium text-[#5d6659]"
        >
          <LoaderCircle
            className="h-6 w-6 animate-spin text-[#36583b]"
            aria-hidden="true"
          />
          <span>Loading recipe details...</span>
        </div>
      ) : detailsError ? (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#f5c2c0] bg-[#fdf2f2] px-4 py-3 text-sm text-[#b42318] sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{detailsError}</span>
          </div>
          {onRetryDetails && (
            <button
              type="button"
              onClick={onRetryDetails}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#f5c2c0] bg-white px-3 py-1.5 text-xs font-semibold text-[#b42318] transition-colors hover:bg-[#fdecea]"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      ) : (
        <>
          <section aria-label="Ingredients">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h4 className="m-0 flex items-center gap-1.5 text-sm font-bold text-[#253b2d]">
                <Utensils className="h-4 w-4 text-[#36583b]" aria-hidden="true" />
                Ingredients
              </h4>
              <span className="rounded-full bg-[#edf2e8] px-2 py-0.5 text-[11px] font-semibold text-[#36583b]">
                {normalized.ingredients.length}
              </span>
            </div>

            {normalized.ingredients.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-[#dce3d5] bg-[#fbfaf6] px-3.5 py-3 text-xs text-[#697065]">
                No ingredients listed for this recipe.
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                {normalized.ingredients.map((ingredient) => {
                  const showIcon =
                    Boolean(ingredient.imageUrl) &&
                    !failedImageUrls.has(ingredient.imageUrl)

                  return (
                    <li
                      key={ingredient.key}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-[#e6ebe1] bg-[#fbfaf6] px-3 py-2"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#eef1ea] bg-white">
                          {showIcon ? (
                            <img
                              src={ingredient.imageUrl}
                              alt={ingredient.name}
                              onError={() => handleImageError(ingredient.imageUrl)}
                              className="h-6 w-6 object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <Utensils
                              className="h-4 w-4 text-[#5f7a61]"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-[#253b2d]">
                              {ingredient.name}
                            </span>
                            {ingredient.optional && (
                              <span className="rounded-full bg-[#eef1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#697065]">
                                optional
                              </span>
                            )}
                          </div>
                          {ingredient.notes && (
                            <p className="m-0 truncate text-[11px] text-[#697065]">
                              {ingredient.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {ingredient.quantityLabel && (
                          <span className="rounded-md border border-[#e2e8dc] bg-white px-2 py-0.5 text-[11px] font-bold text-[#253b2d]">
                            {ingredient.quantityLabel}
                          </span>
                        )}
                        {ingredient.availability !== null && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              ingredient.availability
                                ? 'bg-[#e7f4ea] text-[#266838]'
                                : 'bg-[#fce8e6] text-[#a52a2a]'
                            }`}
                          >
                            {ingredient.availability ? (
                              <>
                                <CheckCircle2
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                <span>In stock</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" aria-hidden="true" />
                                <span>Missing</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-label="Required appliances">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h4 className="m-0 flex items-center gap-1.5 text-sm font-bold text-[#253b2d]">
                <CookingPot className="h-4 w-4 text-[#36583b]" aria-hidden="true" />
                Required Appliances
              </h4>
              <span className="rounded-full bg-[#edf2e8] px-2 py-0.5 text-[11px] font-semibold text-[#36583b]">
                {normalized.appliances.length}
              </span>
            </div>

            {normalized.appliances.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-[#dce3d5] bg-[#fbfaf6] px-3.5 py-3 text-xs text-[#697065]">
                No specific appliances required.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {normalized.appliances.map((appliance) => {
                  const showIcon =
                    Boolean(appliance.imageUrl) &&
                    !failedImageUrls.has(appliance.imageUrl)

                  return (
                    <span
                      key={appliance.key}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#e6ebe1] bg-[#fbfaf6] px-3 py-1.5 text-xs font-semibold text-[#253b2d]"
                    >
                      {showIcon ? (
                        <img
                          src={appliance.imageUrl}
                          alt=""
                          onError={() => handleImageError(appliance.imageUrl)}
                          className="h-4 w-4 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <CookingPot
                          className="h-3.5 w-3.5 text-[#36583b]"
                          aria-hidden="true"
                        />
                      )}
                      <span>{appliance.name}</span>
                      {appliance.availability !== null && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            appliance.availability
                              ? 'bg-[#e7f4ea] text-[#266838]'
                              : 'bg-[#fce8e6] text-[#a52a2a]'
                          }`}
                        >
                          {appliance.availability ? 'Available' : 'Missing'}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            )}
          </section>

          <section aria-label="Cooking instructions">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h4 className="m-0 flex items-center gap-1.5 text-sm font-bold text-[#253b2d]">
                <ListOrdered className="h-4 w-4 text-[#36583b]" aria-hidden="true" />
                Cooking Instructions
              </h4>
              {normalized.steps.length > 0 && (
                <span className="rounded-full bg-[#edf2e8] px-2 py-0.5 text-[11px] font-semibold text-[#36583b]">
                  {normalized.steps.length}{' '}
                  {normalized.steps.length === 1 ? 'step' : 'steps'}
                </span>
              )}
            </div>

            {normalized.steps.length === 0 ? (
              <div
                data-testid="recipe-steps-fallback"
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-[#dce3d5] bg-[#fbfaf6] px-4 py-3.5 text-xs text-[#5d6659] sm:flex-row sm:items-center"
              >
                <p className="m-0">
                  Step-by-step cooking instructions are not available for this recipe.
                </p>
                {onRetryDetails && (
                  <button
                    type="button"
                    onClick={onRetryDetails}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d8dfd2] bg-white px-3 py-1.5 text-xs font-semibold text-[#36583b] transition-colors hover:bg-[#edf2e8]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Try again
                  </button>
                )}
              </div>
            ) : (
              <ol className="m-0 list-none space-y-2.5 p-0">
                {normalized.steps.map((step) => (
                  <li
                    key={step.key}
                    className="flex items-start gap-3 rounded-xl border border-[#e6ebe1] bg-[#fbfaf6] p-3"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#36583b] text-xs font-bold text-white">
                      {step.stepNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      {(step.title || step.durationLabel) && (
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          {step.title && (
                            <span className="text-xs font-bold text-[#253b2d]">
                              {step.title}
                            </span>
                          )}
                          {step.durationLabel && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#5d6659]">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {step.durationLabel}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="m-0 text-sm leading-relaxed text-[#2e4433] break-words">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default RecipeDetailsContent
