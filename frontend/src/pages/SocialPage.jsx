import { useEffect, useState } from 'react'
import { UsersRound } from 'lucide-react'
import AddFriendDialog from '../components/social/AddFriendDialog.jsx'
import FriendsPanel from '../components/social/FriendsPanel.jsx'
import FriendRequestsDialog from '../components/social/FriendRequestsDialog.jsx'
import { api } from '../services/api'

const feeds = [
  { id: 'global', label: 'Global' },
  { id: 'friends', label: 'Friends' },
]

function SocialPage() {
  const [activeFeed, setActiveFeed] = useState('global')
  const [isFriendsListOpen, setIsFriendsListOpen] = useState(false)
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false)
  const [isRequestsOpen, setIsRequestsOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [results, setResults] = useState([])
  const [receivedRequests, setReceivedRequests] = useState([])
  const [friends, setFriends] = useState([])
  const [sentUserIds, setSentUserIds] = useState(() => new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [sendingUserId, setSendingUserId] = useState(null)
  const [respondingRequestId, setRespondingRequestId] = useState(null)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [requestsError, setRequestsError] = useState('')
  const [friendsError, setFriendsError] = useState('')

  useEffect(() => {
    let active = true
    api.listFriendRequests()
      .then((requests) => {
        if (active) setReceivedRequests(requests)
      })
      .catch((requestError) => {
        if (active) {
          setRequestsError(
            requestError?.message || 'Could not load friend requests.',
          )
        }
      })
      .finally(() => {
        if (active) setRequestsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isFriendsListOpen) return undefined

    let active = true
    api.listFriends()
      .then((items) => {
        if (active) setFriends(items)
      })
      .catch((requestError) => {
        if (active) {
          setFriendsError(requestError?.message || 'Could not load friends.')
        }
      })
      .finally(() => {
        if (active) setFriendsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isFriendsListOpen])

  useEffect(() => {
    if (!isFriendsListOpen && !isAddFriendOpen && !isRequestsOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsFriendsListOpen(false)
        setIsAddFriendOpen(false)
        setIsRequestsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFriendsListOpen, isAddFriendOpen, isRequestsOpen])

  const resetAddFriend = () => {
    setIsAddFriendOpen(false)
    setUsername('')
    setResults([])
    setHasSearched(false)
    setError('')
    setSuccess('')
  }

  const closeRequests = () => {
    setIsRequestsOpen(false)
    setRequestsError('')
  }

  const openFriendsList = () => {
    setFriendsLoading(true)
    setFriendsError('')
    setIsFriendsListOpen(true)
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    const query = username.trim()
    if (!query) {
      setError('Enter a username to search.')
      return
    }

    setError('')
    setSuccess('')
    setIsSearching(true)
    setHasSearched(true)
    setResults([])
    try {
      setResults(await api.searchUsers(query))
    } catch (requestError) {
      setError(requestError?.message || 'Could not search users. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSendRequest = async (user) => {
    setError('')
    setSuccess('')
    setSendingUserId(user.id)
    try {
      await api.sendFriendRequest(user.id)
      setSentUserIds((previous) => new Set(previous).add(user.id))
      setSuccess(`Friend request sent to @${user.user_name}.`)
    } catch (requestError) {
      setError(requestError?.message || 'Could not send the friend request.')
    } finally {
      setSendingUserId(null)
    }
  }

  const respondToRequest = async (request, action) => {
    setRequestsError('')
    setRespondingRequestId(request.id)
    try {
      if (action === 'accept') {
        await api.acceptFriendRequest(request.id)
        setFriends((previous) => {
          if (previous.some((friend) => friend.id === request.user_id)) {
            return previous
          }
          return [
            ...previous,
            {
              id: request.user_id,
              user_name: request.user_name,
              name: request.name,
              surname: request.surname,
            },
          ].sort((first, second) =>
            first.user_name.localeCompare(second.user_name),
          )
        })
      } else {
        await api.declineFriendRequest(request.id)
      }
      setReceivedRequests((previous) =>
        previous.filter((item) => item.id !== request.id),
      )
    } catch (requestError) {
      setRequestsError(
        requestError?.message || 'Could not update the friend request.',
      )
    } finally {
      setRespondingRequestId(null)
    }
  }

  return (
    <section className="mx-auto w-full max-w-[630px]">
      <div className="sticky top-0 z-20 -mx-6 -mt-12 flex h-14 items-stretch justify-between border-b border-[#e9e9df] bg-white/95 px-2 backdrop-blur-xl max-[520px]:-mx-4 max-[520px]:-mt-8">
        <div className="flex flex-1 items-stretch" role="tablist" aria-label="Social feed">
          {feeds.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeFeed === id}
              onClick={() => setActiveFeed(id)}
              className={`relative flex min-w-0 flex-1 items-center justify-center px-4 text-sm font-semibold transition-colors ${
                activeFeed === id
                  ? 'text-[#253b2d]'
                  : 'text-[#92958b] hover:text-[#4e5e4d]'
              }`}
            >
              {label}
              {activeFeed === id && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-8 bottom-0 h-[3px] rounded-full bg-[#36583b]"
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openFriendsList}
          className="my-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#36583b] transition hover:bg-[#f1f3ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#36583b]"
          aria-label="My friends"
        >
          <UsersRound aria-hidden="true" size={21} strokeWidth={1.9} />
        </button>
      </div>

      <div
        className="min-h-[calc(100dvh-190px)]"
        role="tabpanel"
        aria-label={`${activeFeed} feed`}
      />

      {isFriendsListOpen && (
        <FriendsPanel
          friends={friends}
          loading={friendsLoading}
          error={friendsError}
          requestCount={receivedRequests.length}
          onClose={() => setIsFriendsListOpen(false)}
          onOpenRequests={() => setIsRequestsOpen(true)}
          onOpenAddFriend={() => setIsAddFriendOpen(true)}
        />
      )}

      {isAddFriendOpen && (
        <AddFriendDialog
          username={username}
          results={results}
          sentUserIds={sentUserIds}
          isSearching={isSearching}
          sendingUserId={sendingUserId}
          hasSearched={hasSearched}
          error={error}
          success={success}
          onUsernameChange={(event) => {
            setUsername(event.target.value)
            setError('')
            setSuccess('')
            setResults([])
            setHasSearched(false)
          }}
          onSearch={handleSearch}
          onSendRequest={handleSendRequest}
          onClose={resetAddFriend}
        />
      )}

      {isRequestsOpen && (
        <FriendRequestsDialog
          requests={receivedRequests}
          loading={requestsLoading}
          error={requestsError}
          respondingRequestId={respondingRequestId}
          onRespond={respondToRequest}
          onClose={closeRequests}
        />
      )}
    </section>
  )
}

export default SocialPage
