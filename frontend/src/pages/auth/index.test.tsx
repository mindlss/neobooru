import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from 'test/server'
import { renderWithProviders } from 'test/render'
import AuthPage from './index'

describe('AuthPage scenarios', () => {
  it('submits login and shows server error toast', async () => {
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          { error: { message: 'Invalid credentials' } },
          { status: 500 },
        )
      }),
    )

    renderWithProviders(<AuthPage mode="login" />)

    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1!')
    await userEvent.click(screen.getByRole('button', { name: /войти/i }))

    expect(await screen.findByText('Не удалось войти')).toBeInTheDocument()
  })

  it('navigates after successful registration', async () => {
    server.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ status: 'ok', user: { id: 'u1' } }),
      ),
    )

    renderWithProviders(
      <Routes>
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/" element={<div>Home after auth</div>} />
      </Routes>,
      { route: '/register' },
    )

    await userEvent.type(screen.getByLabelText('Username'), 'new_user')
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'Password1!')
    await userEvent.click(screen.getByRole('button', { name: /создать аккаунт/i }))

    expect(await screen.findByText('Home after auth')).toBeInTheDocument()
  })
})
