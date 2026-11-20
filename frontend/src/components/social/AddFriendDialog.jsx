import { LoaderCircle, Search, X } from 'lucide-react'

function AddFriendDialog({
  username,
  results,
  sentUserIds,
  isSearching,
  sendingUserId,
  hasSearched,
  error,
  success,
  onUsernameChange,
  onSearch,
  onSendRequest,
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
        aria-labelledby="add-friend-title"
        className="max-h-[min(86dvh,720px)] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="add-friend-title"
              className="m-0 text-2xl font-bold text-[#253b2d]"
            >
              Add a friend
            </h2>
            <p className="mb-0 mt-2 text-sm leading-6 text-[#74796e]">
              Search by username and send a friend request.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#777a72] transition hover:bg-[#f3f4ee] hover:text-[#253b2d]"
            aria-label="Close add friend dialog"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <form onSubmit={onSearch} className="mt-6">
          <label
            htmlFor="friend-username"
            className="mb-2 block text-sm font-semibold text-[#354a39]"
          >
            Username
          </label>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-[#dfe3d8] bg-[#fbfcf9] px-3 focus-within:border-[#6d8a64] focus-within:ring-2 focus-within:ring-[#dce7d4]">
              <span
                aria-hidden="true"
                className="mr-1 text-sm text-[#8b9086]"
              >
                @
              </span>
              <input
                id="friend-username"
                type="search"
                value={username}
                onChange={onUsernameChange}
                placeholder="e.g. beechef"
                maxLength={30}
                autoComplete="off"
                autoFocus
                className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[#253b2d] outline-none placeholder:text-[#a0a49a]"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#36583b] px-4 text-sm font-semibold text-white transition hover:bg-[#29472f] disabled:cursor-wait disabled:opacity-60"
            >
              {isSearching ? (
                <LoaderCircle
                  aria-hidden="true"
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Search aria-hidden="true" size={17} />
              )}
              <span className="sr-only sm:not-sr-only">
                {isSearching ? 'Searching' : 'Search'}
              </span>
            </button>
          </div>
        </form>

        {error && (
          <p
            role="alert"
            className="mb-0 mt-4 rounded-xl bg-[#fff1ed] px-4 py-3 text-sm text-[#a33d2c]"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            role="status"
            className="mb-0 mt-4 rounded-xl bg-[#eff5eb] px-4 py-3 text-sm text-[#36583b]"
          >
            {success}
          </p>
        )}

        <div className="mt-4 space-y-2" aria-live="polite">
          {results.map((user) => {
            const isSent = sentUserIds.has(user.id)
            const isSending = sendingUserId === user.id

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-[#eeefe8] p-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf2e8] font-bold text-[#456346]">
                  {(user.name || user.user_name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-sm font-semibold text-[#2e4433]">
                    {user.name} {user.surname}
                  </p>
                  <p className="m-0 mt-0.5 truncate text-xs text-[#81867c]">
                    @{user.user_name}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSent || sendingUserId !== null}
                  onClick={() => onSendRequest(user)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition disabled:cursor-default ${
                    isSent
                      ? 'bg-[#f0f3ec] text-[#71816b]'
                      : 'bg-[#36583b] text-white hover:bg-[#29472f] disabled:opacity-60'
                  }`}
                >
                  {isSent ? 'Request sent' : isSending ? 'Sending…' : 'Add'}
                </button>
              </div>
            )
          })}
          {hasSearched && !isSearching && results.length === 0 && !error && (
            <p className="mb-0 rounded-2xl bg-[#f7f8f4] px-4 py-5 text-center text-sm text-[#777a72]">
              No users found. Check the username and try again.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default AddFriendDialog
