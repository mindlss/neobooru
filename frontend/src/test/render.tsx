import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ToastProvider } from 'app/lib/ToastProvider'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: { route?: string; withRouter?: boolean } = {},
) {
  const queryClient = createTestQueryClient()
  const route = options.route ?? '/'
  const withRouter = options.withRouter ?? true

  function Providers({ children }: { children: ReactNode }) {
    const content = (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    )

    return withRouter ? (
      <MemoryRouter initialEntries={[route]}>{content}</MemoryRouter>
    ) : (
      content
    )
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Providers }),
  }
}
