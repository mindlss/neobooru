import { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

interface RouterProviderProps {
  children: ReactNode
}

export const RouterProvider = ({ children }: RouterProviderProps) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
)
