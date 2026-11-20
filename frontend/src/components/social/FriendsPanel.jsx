import { ArrowLeft, Bell, LoaderCircle, Plus } from 'lucide-react'

function FriendsPanel({
  friends,
  loading,
  error,
  requestCount,
  onClose,
  onOpenRequests,
  onOpenAddFriend,
}) {
  return (
    <div
      className="fixed inset-0 z-20 flex justify-center bg-[#fbfaf6]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="region"
        aria-label="Friends list"
        className="h-[100dvh] w-full max-w-[630px] overflow-y-auto px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e9e9df] bg-[#fbfaf6]/95 py-2 backdrop-blur-xl">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#36583b] transition hover:bg-[#f1f3ed]"
            aria-label="Back to social feed"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
          <h2 className="m-0 text-base font-semibold text-[#253b2d]">Friends</h2>
          <div className="flex items-center">
            <button
              type="button"
              onClick={onOpenRequests}
              className="relative flex h-11 w-11 items-center justify-center rounded-full text-[#36583b] transition hover:bg-[#f1f3ed]"
              aria-label={`Friend requests${requestCount ? ` (${requestCount})` : ''}`}
            >
              <Bell aria-hidden="true" size={20} strokeWidth={1.9} />
              {requestCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b94332] px-1 text-[10px] font-bold leading-none text-white">
                  {requestCount > 99 ? '99+' : requestCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenAddFriend}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#36583b] transition hover:bg-[#f1f3ed]"
              aria-label="Add friend"
            >
              <Plus aria-hidden="true" size={22} strokeWidth={2} />
            </button>
          </div>
        </header>

        {error && (
          <p
            role="alert"
            className="mb-0 mt-3 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#a33d2c]"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10 text-[#52704d]">
            <LoaderCircle
              aria-label="Loading friends"
              size={22}
              className="animate-spin"
            />
          </div>
        ) : (
          <div className="mx-auto max-w-[500px] space-y-2" aria-live="polite">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 border-b border-[#e9e9df] px-2 py-4"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf2e8] font-bold text-[#456346]">
                  {(friend.name || friend.user_name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[#2e4433]">
                    {friend.name} {friend.surname}
                  </p>
                  <p className="m-0 mt-0.5 truncate text-xs text-[#81867c]">
                    @{friend.user_name}
                  </p>
                </div>
              </div>
            ))}
            {friends.length === 0 && !error && (
              <p className="mb-0 py-10 text-center text-sm text-[#777a72]">
                No friends yet.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default FriendsPanel
