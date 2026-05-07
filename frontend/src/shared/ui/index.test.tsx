import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from 'test/render'
import { Avatar, Badge, Button, Tabs } from './index'

describe('shared ui components', () => {
  it('renders button variants and handles clicks', async () => {
    const onClick = vi.fn()
    renderWithProviders(<Button onClick={onClick}>Save</Button>)

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'ui-button--primary',
    )
  })

  it('renders avatar image or fallback initial', () => {
    renderWithProviders(
      <>
        <Avatar alt="Alice" src="https://cdn.test/a.png" />
        <Avatar alt="Bob" />
      </>,
    )

    expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute(
      'src',
      'https://cdn.test/a.png',
    )
    expect(screen.getByText('B')).toHaveClass('ui-avatar')
  })

  it('renders badges and changes tabs', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <>
        <Badge tone="danger">18+</Badge>
        <Tabs
          items={[
            { id: 'uploads', label: 'Uploads' },
            { id: 'favorites', label: 'Favorites' },
          ]}
          value="uploads"
          onChange={onChange}
        />
      </>,
    )

    expect(screen.getByText('18+')).toHaveClass('ui-badge--danger')
    expect(screen.getByRole('tab', { name: 'Uploads' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(onChange).toHaveBeenCalledWith('favorites')
  })
})
