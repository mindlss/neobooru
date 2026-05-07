import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from 'test/server'
import { renderWithProviders } from 'test/render'
import UploadPage from './index'

describe('UploadPage scenarios', () => {
  it('submits form data and navigates to uploaded media', async () => {
    server.use(
      http.post('/api/media/upload', () =>
        HttpResponse.json({ id: 'new-media-id' }),
      ),
    )

    renderWithProviders(
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/media/:id" element={<div>Uploaded media page</div>} />
      </Routes>,
      { route: '/upload' },
    )

    const file = new File(['image'], 'image.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Файл'), {
      target: { files: [file] },
    })
    await userEvent.type(screen.getByLabelText('Описание'), 'new upload')
    await userEvent.type(screen.getByLabelText('Теги'), 'tag_one tag_two')
    fireEvent.submit(screen.getByRole('button', { name: /загрузить/i }).closest('form')!)

    expect(await screen.findByText('Uploaded media page')).toBeInTheDocument()
  })

  it('shows a server error toast', async () => {
    server.use(
      http.post(
        '/api/media/upload',
        () => new HttpResponse(null, { status: 500 }),
      ),
    )

    renderWithProviders(<UploadPage />)

    const file = new File(['image'], 'image.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('Файл'), {
      target: { files: [file] },
    })
    fireEvent.submit(screen.getByRole('button', { name: /загрузить/i }).closest('form')!)

    expect(await screen.findByText('Не удалось загрузить файл')).toBeInTheDocument()
  })
})
