import { Check, LoaderCircle, X } from 'lucide-react'

function FriendRequestsDialog({
  requests,
  loading,
  error,
  respondingRequestId,
  onRespond,
  onClose,
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-[#17251c]/40 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-[2px] sm:items-center sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-requests-title"
        className="max-h-[min(86dvh,720px)] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <h2
            id="friend-requests-title"
            className="m-0 text-xl font-bold text-[#253b2d]"
          >
            Friend requests
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#777a72] transition hover:bg-[#f3f4ee] hover:text-[#253b2d]"
            aria-label="Close friend requests"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-0 mt-4 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#a33d2c]"
          >
            {error}
          </p>
        )}

        <div className="mt-4 space-y-2" aria-live="polite">
          {loading ? (
            <div className="flex justify-center py-8 text-[#52704d]">
              <LoaderCircle
                aria-label="Loading friend requests"
                size={22}
                className="animate-spin"
              />
            </div>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 rounded-2xl border border-[#eeefe8] p-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf2e8] font-bold text-[#456346]">
                  {(request.name || request.user_name)
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[#2e4433]">
                    {request.name} {request.surname}
                  </p>
                  <p className="m-0 mt-0.5 truncate text-xs text-[#81867c]">
                    @{request.user_name}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={respondingRequestId !== null}
                  onClick={() => onRespond(request, 'accept')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf2e8] text-[#36583b] transition hover:bg-[#dfe9d7] disabled:opacity-50"
                  aria-label={`Accept request from @${request.user_name}`}
                >
                  {respondingRequestId === request.id ? (
                    <LoaderCircle
                      aria-hidden="true"
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Check aria-hidden="true" size={19} />
                  )}
                </button>
                <button
                  type="button"
                  disabled={respondingRequestId !== null}
                  onClick={() => onRespond(request, 'decline')}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#777a72] transition hover:bg-[#f3f4ee] disabled:opacity-50"
                  aria-label={`Decline request from @${request.user_name}`}
                >
                  <X aria-hidden="true" size={18} />
                </button>
              </div>
            ))
          )}
          {!loading && requests.length === 0 && !error && (
            <p className="mb-0 py-8 text-center text-sm text-[#777a72]">
              No incoming friend requests.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default FriendRequestsDialog
