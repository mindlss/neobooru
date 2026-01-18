import { ReactNode } from 'react'
import { ReactStrictModeProvider } from './ReactStrictModeProvider'
import { RouterProvider } from './RouterProvider'
import { ToastProvider } from './ToastProvider'

interface CombinedProvidersProps {
  children: ReactNode
}

export const CombinedProviders = ({ children }: CombinedProvidersProps) => {
  return (
    <ReactStrictModeProvider>
      <RouterProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </RouterProvider>
    </ReactStrictModeProvider>
  )
}
