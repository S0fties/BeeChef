import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '../src/App.jsx'

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App navigation', () => {
  it('shows the Social page by default and marks its navigation link active', async () => {
    renderApp()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Social Media' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Social' })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  it('shows all five navigation links with clean URLs', () => {
    renderApp('/social')

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
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

    await user.click(screen.getByRole('link', { name: label }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'aria-current',
        'page',
      )
    })
  })

  it('redirects unknown routes to the Social page', async () => {
    renderApp('/unknown')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Social Media' })).toBeInTheDocument()
    })
  })
})
