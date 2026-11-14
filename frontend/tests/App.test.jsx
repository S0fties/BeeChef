import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.jsx'
import { AuthProvider, useAuth } from '../src/context/AuthContext.jsx'
import { ApiError, api } from '../src/services/api'

// Replace the network layer only. getToken/setToken/ApiError stay real, so the
// real AuthProvider still reads and writes localStorage.
vi.mock('../src/services/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    api: {
      register: vi.fn(),
      login: vi.fn(),
      me: vi.fn(),
      changePassword: vi.fn(),
    },
  }
})

const testUser = {
  id: 1,
  email: 'chef@example.com',
  name: 'Bee',
  surname: 'Chef',
  user_name: 'beechef',
}

function renderApp(initialPath = '/', { authenticated = true } = {}) {
  if (authenticated) {
    localStorage.setItem('access_token', 'test-token')
    api.me.mockResolvedValue(testUser)
  }
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
})

describe('App navigation (logged in)', () => {
  it('shows the Recipe Generator page by default and marks its navigation link active', async () => {
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recipe Generator' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Recipe Generator' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  it('shows all five navigation links with clean URLs', async () => {
    renderApp('/social')

    expect(
      await screen.findByRole('navigation', { name: 'Main navigation' }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Social' })).toHaveAttribute('href', '/social')
    expect(screen.getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'href',
      '/inventory',
    )
    expect(screen.getByRole('link', { name: 'Recipe Generator' })).toHaveAttribute(
      'href',
      '/recipes',
    )
    expect(screen.getByRole('link', { name: 'Shopping' })).toHaveAttribute(
      'href',
      '/shopping',
    )
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it.each([
    { label: 'Social', heading: 'Social Media' },
    { label: 'Inventory', heading: 'Inventory' },
    { label: 'Recipe Generator', heading: 'Recipe Generator' },
    { label: 'Shopping', heading: 'Shopping' },
    { label: 'Profile', heading: 'Profile' },
  ])('navigates to $label and updates the active link', async ({ label, heading }) => {
    const user = userEvent.setup()
    renderApp('/social')

    await user.click(await screen.findByRole('link', { name: label }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  it('redirects unknown routes to the Recipe Generator page', async () => {
    renderApp('/unknown')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Recipe Generator' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Recipe Generator' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })
})

describe('App authentication', () => {
  it('redirects a logged-out visitor to the login page', async () => {
    renderApp('/inventory', { authenticated: false })

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(api.me).not.toHaveBeenCalled() // no token, so no request
  })

  it('redirects a logged-in user away from the login page', async () => {
    renderApp('/login')

    expect(
      await screen.findByRole('heading', { name: 'Recipe Generator' }),
    ).toBeInTheDocument()
  })

  it('checks the stored token with /auth/me when the page loads', async () => {
    renderApp('/inventory')

    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument()
    expect(api.me).toHaveBeenCalledTimes(1)
  })

  it('clears the session and shows login when the token is rejected (401)', async () => {
    localStorage.setItem('access_token', 'expired-token')
    api.me.mockRejectedValue(new ApiError(401, 'Invalid or expired token'))
    renderApp('/inventory', { authenticated: false })

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('logs in with valid credentials and enters the app', async () => {
    const user = userEvent.setup()
    api.login.mockResolvedValue({ access_token: 'new-token' })
    api.me.mockResolvedValue(testUser)
    renderApp('/profile', { authenticated: false })

    await user.type(await screen.findByPlaceholderText('Email'), 'chef@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByRole('heading', { name: 'Recipe Generator' }),
    ).toBeInTheDocument()
    expect(api.login).toHaveBeenCalledWith({
      email: 'chef@example.com',
      password: 'correct-horse-battery',
    })
    expect(localStorage.getItem('access_token')).toBe('new-token')
  })

  it('shows the backend error message when login fails', async () => {
    const user = userEvent.setup()
    api.login.mockRejectedValue(new ApiError(401, 'Incorrect email or password'))
    renderApp('/profile', { authenticated: false })

    await user.type(await screen.findByPlaceholderText('Email'), 'chef@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Incorrect email or password')).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('registers a new account and logs in', async () => {
    const user = userEvent.setup()
    api.register.mockResolvedValue(testUser)
    api.login.mockResolvedValue({ access_token: 'new-token' })
    api.me.mockResolvedValue(testUser)
    renderApp('/login', { authenticated: false })

    await user.click(await screen.findByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByPlaceholderText('Name'), 'Bee')
    await user.type(screen.getByPlaceholderText('Surname'), 'Chef')
    await user.type(screen.getByPlaceholderText('Username'), 'beechef')
    await user.type(screen.getByPlaceholderText('Email'), 'chef@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(
      await screen.findByRole('heading', { name: 'Recipe Generator' }),
    ).toBeInTheDocument()
    expect(api.register).toHaveBeenCalledWith({
      email: 'chef@example.com',
      password: 'correct-horse-battery',
      name: 'Bee',
      surname: 'Chef',
      user_name: 'beechef',
    })
    expect(api.login).toHaveBeenCalledWith({
      email: 'chef@example.com',
      password: 'correct-horse-battery',
    })
  })

  it('shows the backend error message when registration fails', async () => {
    const user = userEvent.setup()
    api.register.mockRejectedValue(new ApiError(400, 'Email already registered'))
    renderApp('/login', { authenticated: false })

    await user.click(await screen.findByRole('button', { name: 'Need an account? Register' }))
    await user.type(screen.getByPlaceholderText('Name'), 'Bee')
    await user.type(screen.getByPlaceholderText('Surname'), 'Chef')
    await user.type(screen.getByPlaceholderText('Username'), 'beechef')
    await user.type(screen.getByPlaceholderText('Email'), 'chef@example.com')
    await user.type(screen.getByPlaceholderText('Password'), 'correct-horse-battery')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
    expect(api.login).not.toHaveBeenCalled()
  })

  it('shows the user details on the profile page and logs out', async () => {
    const user = userEvent.setup()
    renderApp('/profile')

    expect(await screen.findByText('Bee Chef')).toBeInTheDocument()
    expect(screen.getByText('chef@example.com')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(localStorage.getItem('access_token')).toBeNull()
  })
})

describe('AuthProvider', () => {
  function PasswordChangeHarness() {
    const { changePassword } = useAuth()
    return (
      <button
        onClick={() =>
          changePassword({
            email: 'chef@example.com',
            current_password: 'old-password',
            new_password: 'new-password-1',
          })
        }
      >
        Change password
      </button>
    )
  }

  it('sends the password change request to the API', async () => {
    const user = userEvent.setup()
    api.changePassword.mockResolvedValue(null)
    render(
      <AuthProvider>
        <PasswordChangeHarness />
      </AuthProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(api.changePassword).toHaveBeenCalledWith({
      email: 'chef@example.com',
      current_password: 'old-password',
      new_password: 'new-password-1',
    })
  })
})