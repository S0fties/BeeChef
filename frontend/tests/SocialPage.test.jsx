import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SocialPage from '../src/pages/SocialPage.jsx'
import { api } from '../src/services/api'

vi.mock('../src/services/api', () => ({
  api: {
    searchUsers: vi.fn(),
    sendFriendRequest: vi.fn(),
    listFriendRequests: vi.fn(),
    listFriends: vi.fn(),
    acceptFriendRequest: vi.fn(),
    declineFriendRequest: vi.fn(),
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
  api.listFriendRequests.mockResolvedValue([])
  api.listFriends.mockResolvedValue([])
})

const openFriendsList = async (user) => {
  await user.click(screen.getByRole('button', { name: 'My friends' }))
  return screen.getByRole('region', { name: 'Friends list' })
}

const openAddFriendDialog = async (user) => {
  const friendsList = await openFriendsList(user)
  await user.click(within(friendsList).getByRole('button', { name: 'Add friend' }))
  return screen.getByRole('dialog', { name: 'Add a friend' })
}

const openRequestsDialog = async (user) => {
  const friendsList = await openFriendsList(user)
  await user.click(
    await within(friendsList).findByRole('button', {
      name: /^Friend requests/,
    }),
  )
  return screen.getByRole('dialog', { name: 'Friend requests' })
}

describe('SocialPage', () => {
  it('keeps global and friends feeds empty', async () => {
    const user = userEvent.setup()
    render(<SocialPage />)

    expect(screen.getByRole('tab', { name: 'Global' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel', { name: 'global feed' })).toBeEmptyDOMElement()

    await user.click(screen.getByRole('tab', { name: 'Friends' }))

    expect(screen.getByRole('tab', { name: 'Friends' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel', { name: 'friends feed' })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: 'friends feed' })).toBeEmptyDOMElement()
    await user.click(screen.getByRole('tab', { name: 'Global' }))
    expect(screen.getByRole('tabpanel', { name: 'global feed' })).toBeEmptyDOMElement()
    expect(api.listFriends).not.toHaveBeenCalled()
    expect(api.searchUsers).not.toHaveBeenCalled()
  })

  it('searches by username and sends a friend request', async () => {
    const user = userEvent.setup()
    api.searchUsers.mockResolvedValue([
      { id: 12, user_name: 'maya', name: 'Maya', surname: 'Chef' },
    ])
    api.sendFriendRequest.mockResolvedValue({ id: 5, status: 'pending' })
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(
      screen.getByRole('searchbox', { name: 'Username' }),
      '  maya  ',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('@maya')).toBeInTheDocument()
    expect(api.searchUsers).toHaveBeenCalledWith('maya')

    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(api.sendFriendRequest).toHaveBeenCalledWith(12)
      expect(within(dialog).getByRole('button', { name: 'Request sent' })).toBeDisabled()
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Friend request sent to @maya.',
    )
  })

  it('shows API errors when a friend search fails', async () => {
    const user = userEvent.setup()
    api.searchUsers.mockRejectedValue(new Error('Search unavailable'))
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(screen.getByRole('searchbox', { name: 'Username' }), 'maya')
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable')
  })

  it('requires a username before searching', async () => {
    const user = userEvent.setup()
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Enter a username to search.',
    )
    expect(api.searchUsers).not.toHaveBeenCalled()
  })

  it('shows an empty state when username search returns no users', async () => {
    const user = userEvent.setup()
    api.searchUsers.mockResolvedValue([])
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Username' }),
      'unknown',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(
      await within(dialog).findByText(
        'No users found. Check the username and try again.',
      ),
    ).toBeInTheDocument()
    expect(api.searchUsers).toHaveBeenCalledWith('unknown')
  })

  it('keeps the result available when sending a request fails', async () => {
    const user = userEvent.setup()
    api.searchUsers.mockResolvedValue([
      { id: 12, user_name: 'maya', name: 'Maya', surname: 'Chef' },
    ])
    api.sendFriendRequest.mockRejectedValue(
      new Error('Could not send request'),
    )
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Username' }),
      'maya',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))
    await within(dialog).findByText('@maya')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not send request',
    )
    expect(within(dialog).getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(api.sendFriendRequest).toHaveBeenCalledWith(12)
  })

  it('disables the send action while a request is being submitted', async () => {
    const user = userEvent.setup()
    let resolveSendRequest
    api.searchUsers.mockResolvedValue([
      { id: 12, user_name: 'maya', name: 'Maya', surname: 'Chef' },
      { id: 13, user_name: 'ali', name: 'Ali', surname: 'Chef' },
    ])
    api.sendFriendRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSendRequest = resolve
        }),
    )
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Username' }),
      'maya',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))
    await within(dialog).findByText('@maya')
    const addButtons = within(dialog).getAllByRole('button', { name: 'Add' })
    await user.click(addButtons[0])

    expect(
      within(dialog).getByRole('button', { name: 'Sending…' }),
    ).toBeDisabled()
    expect(
      within(dialog).getAllByRole('button', { name: 'Add' })[0],
    ).toBeDisabled()
    await act(async () => resolveSendRequest({ id: 5, status: 'pending' }))
    expect(
      await within(dialog).findByRole('button', { name: 'Request sent' }),
    ).toBeDisabled()
    expect(
      within(dialog).getByRole('button', { name: 'Add' }),
    ).toBeEnabled()
  })

  it('shows a loading state while searching', async () => {
    const user = userEvent.setup()
    let resolveSearch
    api.searchUsers.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSearch = resolve
        }),
    )
    render(<SocialPage />)

    const dialog = await openAddFriendDialog(user)
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Username' }),
      'maya',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Search' }))

    expect(
      within(dialog).getByRole('button', { name: 'Searching' }),
    ).toBeDisabled()
    await act(async () => resolveSearch([]))
    expect(
      await within(dialog).findByText(
        'No users found. Check the username and try again.',
      ),
    ).toBeInTheDocument()
  })

  it('shows incoming requests and accepts one', async () => {
    const user = userEvent.setup()
    let resolveAccept
    api.listFriendRequests.mockResolvedValue([
      {
        id: 8,
        user_id: 14,
        user_name: 'maya',
        name: 'Maya',
        surname: 'Chef',
        status: 'pending',
      },
    ])
    api.acceptFriendRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAccept = resolve
        }),
    )
    render(<SocialPage />)

    await openFriendsList(user)
    await user.click(
      await screen.findByRole('button', { name: 'Friend requests (1)' }),
    )
    expect(await screen.findByText('@maya')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accept request from @maya' }))
    expect(
      screen.getByRole('button', { name: 'Accept request from @maya' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Decline request from @maya' }),
    ).toBeDisabled()
    await act(async () => resolveAccept({ id: 8, status: 'accepted' }))

    await waitFor(() => {
      expect(api.acceptFriendRequest).toHaveBeenCalledWith(8)
      expect(within(screen.getByRole('dialog')).queryByText('@maya')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Friend requests' })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Close friend requests' }))
    expect(screen.getByText('@maya')).toBeInTheDocument()
  })

  it('shows friend request loading and empty states', async () => {
    const user = userEvent.setup()
    let resolveRequests
    api.listFriendRequests.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequests = resolve
        }),
    )
    render(<SocialPage />)

    const dialog = await openRequestsDialog(user)
    expect(
      within(dialog).getByLabelText('Loading friend requests'),
    ).toBeInTheDocument()

    await act(async () => resolveRequests([]))
    expect(
      await within(dialog).findByText('No incoming friend requests.'),
    ).toBeInTheDocument()
  })

  it('shows an error when incoming requests cannot be loaded', async () => {
    const user = userEvent.setup()
    api.listFriendRequests.mockRejectedValue(
      new Error('Requests unavailable'),
    )
    render(<SocialPage />)

    const dialog = await openRequestsDialog(user)
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Requests unavailable',
    )
    expect(
      within(dialog).queryByText('No incoming friend requests.'),
    ).not.toBeInTheDocument()
  })

  it('keeps an incoming request when accepting it fails', async () => {
    const user = userEvent.setup()
    api.listFriendRequests.mockResolvedValue([
      {
        id: 8,
        user_id: 14,
        user_name: 'maya',
        name: 'Maya',
        surname: 'Chef',
        status: 'pending',
      },
    ])
    api.acceptFriendRequest.mockRejectedValue(
      new Error('Could not accept request'),
    )
    render(<SocialPage />)

    const dialog = await openRequestsDialog(user)
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Accept request from @maya',
      }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not accept request',
    )
    expect(
      within(dialog).getByRole('button', {
        name: 'Accept request from @maya',
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Friend requests (1)' }),
    ).toBeInTheDocument()
    expect(api.acceptFriendRequest).toHaveBeenCalledWith(8)
  })

  it('declines incoming friend requests', async () => {
    const user = userEvent.setup()
    api.listFriendRequests.mockResolvedValue([
      {
        id: 9,
        user_id: 15,
        user_name: 'ali',
        name: 'Ali',
        surname: 'Chef',
        status: 'pending',
      },
    ])
    api.declineFriendRequest.mockResolvedValue(null)
    render(<SocialPage />)

    await openFriendsList(user)
    await user.click(
      await screen.findByRole('button', { name: 'Friend requests (1)' }),
    )
    await user.click(screen.getByRole('button', { name: 'Decline request from @ali' }))

    await waitFor(() => {
      expect(api.declineFriendRequest).toHaveBeenCalledWith(9)
      expect(screen.queryByText('@ali')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Friend requests' }),
      ).toBeInTheDocument()
    })
  })

  it('keeps an incoming request when declining it fails', async () => {
    const user = userEvent.setup()
    api.listFriendRequests.mockResolvedValue([
      {
        id: 9,
        user_id: 15,
        user_name: 'ali',
        name: 'Ali',
        surname: 'Chef',
        status: 'pending',
      },
    ])
    api.declineFriendRequest.mockRejectedValue(
      new Error('Could not decline request'),
    )
    render(<SocialPage />)

    const dialog = await openRequestsDialog(user)
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Decline request from @ali',
      }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not decline request',
    )
    expect(
      within(dialog).getByRole('button', {
        name: 'Decline request from @ali',
      }),
    ).toBeEnabled()
    expect(api.declineFriendRequest).toHaveBeenCalledWith(9)
  })

  it('closes the add-friend dialog with Escape', async () => {
    const user = userEvent.setup()
    render(<SocialPage />)

    await openAddFriendDialog(user)
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Add a friend' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Friends list' })).not.toBeInTheDocument()
  })

  it('opens the friends list separately from the Friends feed', async () => {
    const user = userEvent.setup()
    api.listFriends.mockResolvedValue([
      { id: 7, user_name: 'maya', name: 'Maya', surname: 'Chef' },
    ])
    render(<SocialPage />)

    await user.click(screen.getByRole('tab', { name: 'Friends' }))
    expect(screen.queryByText('@maya')).not.toBeInTheDocument()
    const friendsList = await openFriendsList(user)

    expect(await screen.findByText('@maya')).toBeInTheDocument()
    expect(friendsList).toBeInTheDocument()
    expect(
      within(friendsList).getByRole('button', { name: 'Add friend' }),
    ).toBeInTheDocument()
    expect(
      within(friendsList).getByRole('button', { name: 'Friend requests' }),
    ).toBeInTheDocument()
    expect(api.listFriends).toHaveBeenCalledTimes(1)
  })

  it('shows loading and empty states in the friends list', async () => {
    const user = userEvent.setup()
    let resolveFriends
    api.listFriends.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFriends = resolve
        }),
    )
    render(<SocialPage />)

    const friendsList = await openFriendsList(user)
    expect(within(friendsList).getByLabelText('Loading friends')).toBeInTheDocument()

    await act(async () => resolveFriends([]))
    expect(
      await within(friendsList).findByText('No friends yet.'),
    ).toBeInTheDocument()
  })

  it('reports a friends-list error and retries when reopened', async () => {
    const user = userEvent.setup()
    api.listFriends
      .mockRejectedValueOnce(new Error('Friends unavailable'))
      .mockResolvedValueOnce([
        { id: 7, user_name: 'maya', name: 'Maya', surname: 'Chef' },
      ])
    render(<SocialPage />)

    let friendsList = await openFriendsList(user)
    expect(await within(friendsList).findByRole('alert')).toHaveTextContent(
      'Friends unavailable',
    )
    expect(within(friendsList).queryByText('No friends yet.')).not.toBeInTheDocument()

    await user.click(
      within(friendsList).getByRole('button', { name: 'Back to social feed' }),
    )
    friendsList = await openFriendsList(user)

    expect(await within(friendsList).findByText('@maya')).toBeInTheDocument()
    expect(within(friendsList).queryByRole('alert')).not.toBeInTheDocument()
    expect(api.listFriends).toHaveBeenCalledTimes(2)
  })
})
