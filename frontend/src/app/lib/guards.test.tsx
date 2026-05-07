import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from 'test/render'
import { RequireAnyPermission, RequireAuth } from './guards'

interface SessionMock {
  isLoading: boolean
  isAuthenticated: boolean
  hasAnyPermission: (permissions: string[]) => boolean
}

const useSessionMock = vi.fn<() => SessionMock>()

vi.mock('features/auth/session', () => ({
  useSession: () => useSessionMock(),
}))

describe('route guards', () => {
  it('shows loading state while session is loading', () => {
    useSessionMock.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      hasAnyPermission: () => false,
    })

    renderWithProviders(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    )

    expect(screen.getByText('Проверяем сессию...')).toBeInTheDocument()
  })

  it('redirects anonymous users to login and keeps protected state hidden', () => {
    useSessionMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      hasAnyPermission: () => false,
    })

    renderWithProviders(
      <Routes>
        <Route
          path="/upload"
          element={
            <RequireAuth>
              <div>Protected upload</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>,
      { route: '/upload' },
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected upload')).not.toBeInTheDocument()
  })

  it('renders protected content for authenticated users', () => {
    useSessionMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasAnyPermission: () => false,
    })

    renderWithProviders(
      <RequireAuth>
        <div>Protected upload</div>
      </RequireAuth>,
    )

    expect(screen.getByText('Protected upload')).toBeInTheDocument()
  })

  it('checks permission-based access', () => {
    useSessionMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasAnyPermission: (permissions: string[]) =>
        permissions.includes('moderation.queue.read'),
    })

    renderWithProviders(
      <RequireAnyPermission permissions={['moderation.queue.read']}>
        <div>Moderation queue</div>
      </RequireAnyPermission>,
    )

    expect(screen.getByText('Moderation queue')).toBeInTheDocument()
  })

  it('blocks users without required role permissions', () => {
    useSessionMock.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      hasAnyPermission: () => false,
    })

    renderWithProviders(
      <RequireAnyPermission permissions={['reports.admin.read']}>
        <div>Reports</div>
      </RequireAnyPermission>,
    )

    expect(
      screen.getByText('Недостаточно прав для этого раздела.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
  })
})
