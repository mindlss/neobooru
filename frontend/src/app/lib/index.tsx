import { ReactNode } from 'react'
import { ReactStrictModeProvider } from './ReactStrictModeProvider'
import { RouterProvider } from './RouterProvider'
import { ToastProvider } from './ToastProvider'
import { QueryProvider } from './QueryProvider'

interface CombinedProvidersProps {
  children: ReactNode
}

export const CombinedProviders = ({ children }: CombinedProvidersProps) => {
  return (
    <QueryProvider>
      <ReactStrictModeProvider>
        <RouterProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </RouterProvider>
      </ReactStrictModeProvider>
    </QueryProvider>
  )
}
