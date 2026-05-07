import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from 'test/server'
import { renderWithProviders } from 'test/render'
import HomePage from './index'

function searchItem(id: string, description: string) {
  return {
    id,
    type: 'IMAGE',
    contentType: 'image/png',
    size: 1024,
    width: 100,
    height: 100,
    duration: null,
    description,
    isExplicit: false,
    ratingAvg: 8.5,
    ratingCount: 2,
    myRating: null,
    commentCount: 1,
    hash: `${id}-hash`,
    originalKey: `${id}.png`,
    previewKey: `${id}.webp`,
    moderationStatus: 'APPROVED',
    moderatedAt: null,
    moderatedById: null,
    moderationNotes: null,
    uploadedById: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    deletedBy: null,
    tags: [
      {
        id: 'tag-1',
        name: 'blue_eyes',
        color: '#1ab6a9',
        categoryId: 'cat',
        categoryName: 'general',
        usageCount: 10,
        customColor: null,
        addedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    favorite: false,
    previewUrl: `https://cdn.test/${id}.webp`,
  }
}

describe('HomePage scenarios', () => {
  it('renders loading and then search results with popular tags', async () => {
    server.use(
      http.get('/api/search', () =>
        HttpResponse.json({
          data: [searchItem('media-1', 'Blue eyes preview')],
          nextCursor: null,
          meta: { comicMode: false },
        }),
      ),
      http.get('/api/tags/popular', () =>
        HttpResponse.json({
          data: [
            {
              id: 'popular-1',
              name: 'blue_eyes',
              color: '#1ab6a9',
              usageCount: 10,
            },
          ],
        }),
      ),
    )

    renderWithProviders(<HomePage />)

    expect(screen.getByText('Свежие загрузки')).toBeInTheDocument()
    expect(await screen.findByAltText('Blue eyes preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /blue_eyes10/i })).toBeInTheDocument()
  })

  it('submits search filters and updates results from query params', async () => {
    let requestedQuery = ''

    server.use(
      http.get('/api/search', ({ request }) => {
        requestedQuery = new URL(request.url).searchParams.get('q') ?? ''

        return HttpResponse.json({
          data: [searchItem('media-2', requestedQuery || 'Fresh item')],
          nextCursor: null,
          meta: { comicMode: false },
        })
      }),
      http.get('/api/tags/popular', () => HttpResponse.json({ data: [] })),
    )

    renderWithProviders(<HomePage />)

    await screen.findByAltText('sort:new')
    await userEvent.type(screen.getByLabelText('Запрос'), 'cat ears')
    await userEvent.selectOptions(screen.getByLabelText('Сортировка'), 'rating')
    await userEvent.click(screen.getByRole('button', { name: /искать/i }))

    await waitFor(() => {
      expect(requestedQuery).toBe('cat ears sort:rating')
    })
    expect(await screen.findByText('Результаты для "cat ears"')).toBeInTheDocument()
  })
})
