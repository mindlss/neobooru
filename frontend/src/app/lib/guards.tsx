import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from 'features/auth/session'
import { EmptyState } from 'shared/ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const session = useSession()

  if (session.isLoading) return <EmptyState>Проверяем сессию...</EmptyState>

  if (!session.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export function RequireAnyPermission({
  children,
  permissions,
}: {
  children: ReactNode
  permissions: string[]
}) {
  const session = useSession()

  if (session.isLoading) return <EmptyState>Проверяем права...</EmptyState>

  if (!session.hasAnyPermission(permissions)) {
    return <EmptyState>Недостаточно прав для этого раздела.</EmptyState>
  }

  return children
}
