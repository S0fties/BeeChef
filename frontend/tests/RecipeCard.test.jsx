import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bookmark } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { RecipeCard } from '../src/components/recipes'

const sampleRecipe = {
  id: 101,
  title: 'Crispy Chickpea Bowl',
  description: 'Roasted spiced chickpeas over greens with tahini dressing.',
  image_url: 'https://example.com/chickpea-bowl.jpg',
  prep_time_minutes: 10,
  cook_time_minutes: 20,
  difficulty: 'easy',
  servings: 2,
  is_ai_generated: true,
  tags: ['Vegetarian', 'Quick'],
  ingredients: [
    {
      id: 1,
      name: 'Chickpeas',
      quantity: 250,
      unit: 'g',
      is_available: true,
      notes: 'Rinsed and patted dry',
    },
    {
      id: 2,
      name: 'Tahini',
      quantity: 2,
      unit: 'tbsp',
      is_available: false,
      optional: true,
    },
  ],
  appliances: [
    { id: 81001, name: 'Air Fryer', is_available: true },
    { id: 92002, name: 'Mixing Bowl', is_available: true },
  ],
  steps: [
    {
      title: 'Season',
      instruction: 'Toss chickpeas with olive oil and cumin.',
      duration_minutes: 5,
    },
    {
      title: 'Roast',
      instruction: 'Air fry at 200C until crisp.',
      duration_minutes: 15,
    },
  ],
}

describe('RecipeCard', () => {
  it('renders compact summary metadata with author/source badges', () => {
    const { rerender } = render(<RecipeCard recipe={sampleRecipe} />)

    expect(
      screen.getByRole('heading', { name: 'Crispy Chickpea Bowl' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Crispy Chickpea Bowl' })).toHaveAttribute(
      'src',
      'https://example.com/chickpea-bowl.jpg',
    )
    expect(screen.getByText('30 min')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('2 servings')).toBeInTheDocument()
    expect(screen.getByText('AI Suggestion')).toBeInTheDocument()

    rerender(
      <RecipeCard
        recipe={{
          ...sampleRecipe,
          is_ai_generated: false,
          author: { user_name: 'maya', name: 'Maya', surname: 'Chef' },
        }}
      />,
    )
    expect(screen.getByText('@maya')).toBeInTheDocument()

    rerender(
      <RecipeCard
        recipe={{
          ...sampleRecipe,
          is_ai_generated: false,
          source: 'personal',
        }}
      />,
    )
    expect(screen.getByText('Personal Recipe')).toBeInTheDocument()
  })

  it('expands inline to show ingredients, appliances, and steps, then collapses cleanly', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <RecipeCard recipe={sampleRecipe} />
        <RecipeCard recipe={{ id: 102, title: 'Tomato Soup' }} />
      </div>,
    )

    const firstTrigger = screen.getByRole('button', { name: /Crispy Chickpea Bowl/ })
    const secondTrigger = screen.getByRole('button', { name: /Tomato Soup/ })

    expect(firstTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('region', { name: 'Crispy Chickpea Bowl details' })).not.toBeInTheDocument()

    await user.click(firstTrigger)

    expect(firstTrigger).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByRole('region', { name: 'Crispy Chickpea Bowl details' })
    expect(within(region).getByText('Prep: 10 min')).toBeInTheDocument()
    expect(within(region).getByText('Cook: 20 min')).toBeInTheDocument()
    expect(within(region).getByText('Vegetarian')).toBeInTheDocument()
    expect(within(region).getByText('Chickpeas')).toBeInTheDocument()
    expect(within(region).getByText('250 g')).toBeInTheDocument()
    expect(within(region).getByText('In stock')).toBeInTheDocument()
    expect(within(region).getByText('Missing')).toBeInTheDocument()
    expect(within(region).getByText('Air Fryer')).toBeInTheDocument()
    expect(
      within(region).getByText('Toss chickpeas with olive oil and cumin.'),
    ).toBeInTheDocument()
    expect(
      within(region).getByText('Air fry at 200C until crisp.'),
    ).toBeInTheDocument()

    // Collapse via footer collapse button and verify sibling card stays intact
    await user.click(within(region).getByRole('button', { name: 'Collapse details' }))

    expect(firstTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('region', { name: 'Crispy Chickpea Bowl details' }),
    ).not.toBeInTheDocument()
    expect(secondTrigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports keyboard activation on the card trigger', async () => {
    const user = userEvent.setup()
    render(<RecipeCard recipe={sampleRecipe} />)

    const trigger = screen.getByRole('button', { expanded: false })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard(' ')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('supports controlled expanded state via expanded and onExpandedChange', async () => {
    const user = userEvent.setup()
    const onExpandedChange = vi.fn()
    const { rerender } = render(
      <RecipeCard
        recipe={sampleRecipe}
        expanded={false}
        onExpandedChange={onExpandedChange}
      />,
    )

    const trigger = screen.getByRole('button', { expanded: false })
    await user.click(trigger)
    expect(onExpandedChange).toHaveBeenCalledWith(true, sampleRecipe)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    rerender(
      <RecipeCard
        recipe={sampleRecipe}
        expanded={true}
        onExpandedChange={onExpandedChange}
      />,
    )
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('region', { name: 'Crispy Chickpea Bowl details' }),
    ).toBeInTheDocument()
  })

  it('supports modal expand mode and closes on button click, Escape, and backdrop click', async () => {
    const user = userEvent.setup()
    render(<RecipeCard recipe={sampleRecipe} expandMode="modal" />)

    const trigger = screen.getByRole('button', { expanded: false })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Crispy Chickpea Bowl' })
    expect(
      within(dialog).getByText('Toss chickpeas with olive oil and cumin.'),
    ).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: 'Close recipe details' }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Reopen and close via Escape
    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Reopen and close via backdrop click
    await user.click(trigger)
    const reopenedDialog = screen.getByRole('dialog')
    await user.click(reopenedDialog.parentElement)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('triggers contextual actions without expanding the card (Flow A1)', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()
    const onApprove = vi.fn()
    const onReject = vi.fn()
    const onPublish = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const onCustom = vi.fn()

    render(
      <RecipeCard
        recipe={sampleRecipe}
        onToggleFavorite={onToggleFavorite}
        onApprove={onApprove}
        onReject={onReject}
        onPublish={onPublish}
        onEdit={onEdit}
        onDelete={onDelete}
        actions={[
          {
            key: 'bookmark',
            label: 'Save Note',
            icon: Bookmark,
            onClick: onCustom,
          },
        ]}
      />,
    )

    const trigger = screen.getByRole('button', { expanded: false })

    await user.click(
      screen.getByRole('button', { name: 'Save Crispy Chickpea Bowl to favorites' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Approve Crispy Chickpea Bowl' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Reject Crispy Chickpea Bowl' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Publish Crispy Chickpea Bowl to feed' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Edit Crispy Chickpea Bowl' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Remove Crispy Chickpea Bowl' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save Note' }))

    expect(onToggleFavorite).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onApprove).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onReject).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onPublish).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onEdit).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onDelete).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(onCustom).toHaveBeenCalledWith(sampleRecipe, expect.any(Object))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('reflects favorited, published, and approved/rejected action states', () => {
    const { rerender } = render(
      <RecipeCard
        recipe={sampleRecipe}
        isFavorite={true}
        onToggleFavorite={vi.fn()}
        approvalStatus="approved"
        onApprove={vi.fn()}
        onReject={vi.fn()}
        isPublished={true}
        onShare={vi.fn()}
      />,
    )

    const favButton = screen.getByRole('button', {
      name: 'Remove Crispy Chickpea Bowl from favorites',
    })
    expect(favButton).toHaveAttribute('aria-pressed', 'true')

    const approveButton = screen.getByRole('button', {
      name: 'Approve Crispy Chickpea Bowl',
    })
    expect(approveButton).toBeDisabled()
    expect(approveButton).toHaveTextContent('Approved')

    const publishButton = screen.getByRole('button', {
      name: 'Crispy Chickpea Bowl published to feed',
    })
    expect(publishButton).toBeDisabled()
    expect(publishButton).toHaveTextContent('Published')

    rerender(
      <RecipeCard recipe={sampleRecipe} approvalStatus="rejected" />,
    )
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('renders clean fallbacks when optional metadata or cover photo is missing or broken (Flow E1)', () => {
    const minimalRecipe = {
      id: 202,
      title: 'Mystery Stew',
      image_url: 'https://example.com/broken.jpg',
    }
    const { rerender } = render(<RecipeCard recipe={minimalRecipe} />)

    expect(screen.getByText('No time listed')).toBeInTheDocument()
    expect(screen.getByText('All levels')).toBeInTheDocument()
    expect(screen.getByText('Servings N/A')).toBeInTheDocument()
    expect(screen.getByText('BeeChef Recipe')).toBeInTheDocument()

    const img = screen.getByRole('img', { name: 'Mystery Stew' })
    fireEvent.error(img)

    expect(screen.getByTestId('recipe-cover-placeholder')).toBeInTheDocument()
    expect(screen.getByText('No photo')).toBeInTheDocument()

    // Recovers cleanly if cover URL changes
    rerender(
      <RecipeCard
        recipe={{ ...minimalRecipe, image_url: 'https://example.com/fixed.jpg' }}
      />,
    )
    expect(screen.getByRole('img', { name: 'Mystery Stew' })).toHaveAttribute(
      'src',
      'https://example.com/fixed.jpg',
    )
  })

  it('displays clear fallback messages when expanded details are empty or loading fails (Flow E2)', async () => {
    const user = userEvent.setup()
    const incompleteRecipe = {
      id: 303,
      title: 'Quick Salad',
      prep_time_minutes: 5,
      ingredients: [],
      appliances: [],
      steps: [],
    }

    render(<RecipeCard recipe={incompleteRecipe} />)
    await user.click(screen.getByRole('button', { name: /Quick Salad/ }))

    const region = screen.getByRole('region', { name: 'Quick Salad details' })
    expect(
      within(region).getByText('No ingredients listed for this recipe.'),
    ).toBeInTheDocument()
    expect(
      within(region).getByText('No specific appliances required.'),
    ).toBeInTheDocument()
    expect(within(region).getByTestId('recipe-steps-fallback')).toHaveTextContent(
      'Step-by-step cooking instructions are not available for this recipe.',
    )
  })

  it('handles async onLoadDetails failures and retries while preserving summary', async () => {
    const user = userEvent.setup()
    const onLoadDetails = vi
      .fn()
      .mockRejectedValueOnce(new Error('Could not load recipe steps'))
      .mockResolvedValueOnce({
        steps: ['Mix ingredients', 'Serve chilled'],
      })

    render(
      <RecipeCard
        recipe={{ id: 404, title: 'Gazpacho', prep_time_minutes: 15 }}
        onLoadDetails={onLoadDetails}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Gazpacho/ }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load recipe steps')
    expect(screen.getByRole('heading', { name: 'Gazpacho' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(screen.getByText('Mix ingredients')).toBeInTheDocument()
      expect(screen.getByText('Serve chilled')).toBeInTheDocument()
    })
    expect(onLoadDetails).toHaveBeenCalledTimes(2)
  })
})
