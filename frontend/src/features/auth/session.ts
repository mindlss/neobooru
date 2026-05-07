import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLogout } from 'shared/api/generated/auth/auth'
import { getGetMeQueryKey, useGetMe } from 'shared/api/generated/users/users'
import { STAFF_PERMISSIONS } from 'shared/config/permissions'

export function useSession() {
  const query = useGetMe({
    query: {
      retry: false,
      staleTime: 60_000,
    },
  })

  return useMemo(
    () => {
      const permissions = query.data?.permissions ?? []

      return {
        user: query.data ?? null,
        permissions,
        isLoading: query.isLoading,
        isAuthenticated: !!query.data,
        hasPermission: (permission: string) => permissions.includes(permission),
        hasAnyPermission: (items: string[]) =>
          items.some((permission) => permissions.includes(permission)),
        isStaff: STAFF_PERMISSIONS.some((permission) =>
          permissions.includes(permission),
        ),
      }
    },
    [query.data, query.isLoading],
  )
}

export function useLogoutSession() {
  const queryClient = useQueryClient()

  return useLogout({
    mutation: {
      onSettled: () => {
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() })
      },
    },
  })
}
