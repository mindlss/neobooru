import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { renderWithProviders } from 'test/render'
import AppShell from './index'

const session: {
  isAuthenticated: boolean
  isStaff: boolean
  user: { username: string } | null
} = {
  isAuthenticated: false,
  isStaff: false,
  user: null,
}
const logout = { isPending: false, mutate: vi.fn() }

vi.mock('features/auth/session', () => ({
  useSession: () => session,
  useLogoutSession: () => logout,
}))

function LocationProbe() {
  const location = useLocation()
  return <div>location:{location.pathname + location.search}</div>
}

describe('AppShell scenarios', () => {
  it('navigates from global search form', async () => {
    renderWithProviders(
      <Routes>
        <Route
          path="*"
          element={
            <AppShell>
              <LocationProbe />
            </AppShell>
          }
        />
      </Routes>,
    )

    await userEvent.type(screen.getByLabelText('Поиск'), 'blue eyes')
    await userEvent.keyboard('{Enter}')

    expect(screen.getByText('location:/?q=blue%20eyes')).toBeInTheDocument()
  })

  it('shows staff navigation only for staff sessions', () => {
    session.isAuthenticated = true
    session.isStaff = true
    session.user = { username: 'moderator' }

    renderWithProviders(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    )

    expect(screen.getByTitle('Админка')).toBeInTheDocument()
    expect(screen.getByText('moderator')).toBeInTheDocument()
  })
})
