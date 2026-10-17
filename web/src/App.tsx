import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AdminLogin from './pages/AdminLogin'
import Overview from './pages/Overview'
import NewProject from './pages/NewProject'
import ComingSoon from './pages/ComingSoon'
import AppShell from './components/AppShell'

function FullPageSpinner() {
  return (
    <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={28} />
    </Box>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, restoring } = useAuth()
  const location = useLocation()
  if (restoring) return <FullPageSpinner />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, restoring } = useAuth()
  const location = useLocation()
  if (restoring) return <FullPageSpinner />
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />
  return children
}

// A data router, so pages can use useBlocker (unsaved-changes prompts)
const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestOnly>
        <AdminLogin />
      </GuestOnly>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Overview /> },
      { path: 'projects/new', element: <NewProject /> },
      ...['map', 'proposals', 'projects', 'ideas', 'engagement', 'settings'].map((path) => ({
        path,
        element: <ComingSoon />,
      })),
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
