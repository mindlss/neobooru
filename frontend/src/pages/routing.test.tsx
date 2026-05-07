import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from 'test/server'
import { renderWithProviders } from 'test/render'
import Routing from './index'

const user = {
  id: 'u1',
  username: 'viewer',
  email: 'viewer@example.com',
  birthDate: null,
  avatarUrl: null,
  bio: null,
  website: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  emailVerifiedAt: null,
  showComments: true,
  showRatings: true,
  showFavorites: true,
  showUploads: true,
  uploadCount: 0,
  warningCount: 0,
  isBanned: false,
  roles: ['user'],
  permissions: [],
}

describe('application routing', () => {
  it('redirects protected routes to login when session is expired', async () => {
    server.use(
      http.get('/api/users/me', () => new HttpResponse(null, { status: 401 })),
      http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    )

    renderWithProviders(<Routing />, { route: '/upload' })

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Загрузка' })).not.toBeInTheDocument()
  })

  it('blocks admin route for authenticated users without staff permissions', async () => {
    server.use(
      http.get('/api/users/me', () => HttpResponse.json(user)),
    )

    renderWithProviders(<Routing />, { route: '/admin' })

    expect(
      await screen.findByText('Админ-панель недоступна для текущего пользователя.'),
    ).toBeInTheDocument()
  })

  it('allows staff users to open permitted admin section', async () => {
    server.use(
      http.get('/api/users/me', () =>
        HttpResponse.json({
          ...user,
          permissions: ['moderation.queue_read'],
          roles: ['moderator'],
        }),
      ),
      http.get('/api/moderation/queue', () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    )

    renderWithProviders(<Routing />, { route: '/admin' })

    expect(await screen.findByText('Moderation queue')).toBeInTheDocument()
    expect(await screen.findByText('Очередь пуста.')).toBeInTheDocument()
  })
})
