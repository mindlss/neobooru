import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from 'test/server'
import { api } from './axios'

describe('api axios interceptor', () => {
  it('refreshes an expired session once and retries the original request', async () => {
    let protectedCalls = 0
    let refreshCalls = 0

    server.use(
      http.get('/api/protected', () => {
        protectedCalls += 1

        if (protectedCalls === 1) {
          return new HttpResponse(null, { status: 401 })
        }

        return HttpResponse.json({ ok: true })
      }),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({ status: 'ok' })
      }),
    )

    const response = await api.get<{ ok: boolean }>('/protected')

    expect(response.data).toEqual({ ok: true })
    expect(protectedCalls).toBe(2)
    expect(refreshCalls).toBe(1)
  })

  it('rejects when refresh also fails', async () => {
    server.use(
      http.get('/api/private', () => new HttpResponse(null, { status: 401 })),
      http.post(
        '/api/auth/refresh',
        () => new HttpResponse(null, { status: 401 }),
      ),
    )

    await expect(api.get('/private')).rejects.toMatchObject({
      response: { status: 401 },
    })
  })

  it('does not refresh for login failures', async () => {
    let refreshCalls = 0

    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          { error: { message: 'Invalid credentials' } },
          { status: 401 },
        )
      }),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1
        return HttpResponse.json({ status: 'ok' })
      }),
    )

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    })
    expect(refreshCalls).toBe(0)
  })
})
