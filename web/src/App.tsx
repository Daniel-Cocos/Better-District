import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AdminLogin from './pages/AdminLogin'
import Overview from './pages/Overview'
import MapPage from './pages/MapPage'
import Feed from './pages/Feed'
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
      { path: 'map', element: <MapPage /> },
      { path: 'feed', element: <Feed /> },
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
