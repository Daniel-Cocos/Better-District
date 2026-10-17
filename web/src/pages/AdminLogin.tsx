import { useState, type FormEvent } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { alpha } from '@mui/material/styles'
import Visibility from '@mui/icons-material/VisibilityOutlined'
import VisibilityOff from '@mui/icons-material/VisibilityOffOutlined'
import PersonOutline from '@mui/icons-material/PersonOutlineOutlined'
import LockOutlined from '@mui/icons-material/LockOutlined'
import PlaceOutlined from '@mui/icons-material/PlaceOutlined'
import MapBackdrop from '../components/MapBackdrop'
import { brandBlue } from '../theme'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'

type FieldErrors = { identifier?: string; password?: string }

export default function AdminLogin() {
  const { signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const errors: FieldErrors = {}
    if (!identifier.trim()) errors.identifier = 'Enter your username'
    if (!password) errors.password = 'Enter your password'
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      // On success the auth context updates and the router redirects to the overview
      await signIn({ identifier: identifier.trim(), password })
    } catch (err) {
      setFormError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 6fr)' },
        bgcolor: 'background.default',
      }}
    >
      {/* Brand panel */}
      <Box
        sx={(t) => ({
          position: 'relative',
          overflow: 'hidden',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 6,
          color: '#FFFFFF',
          background: `linear-gradient(160deg, ${brandBlue(t)} 0%, ${alpha(brandBlue(t), 0.82)} 100%)`,
        })}
      >
        <MapBackdrop />

        <Stack direction="row" spacing={1.5} sx={{ position: 'relative', alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#FFFFFF', 0.16),
              border: `1px solid ${alpha('#FFFFFF', 0.28)}`,
            }}
          >
            <PlaceOutlined fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 650, lineHeight: 1.2 }}>Southampton City Council</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Better District admin
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ position: 'relative', maxWidth: 420 }}>
          <Typography variant="h1" component="p" sx={{ mb: 2 }}>
            Look after what residents see.
          </Typography>
          <Typography sx={{ opacity: 0.85 }}>
            Add and edit the events in the Better District app, and moderate residents’ comments.
          </Typography>
        </Box>
      </Box>

      {/* Form panel */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 6, md: 4 },
        }}
      >
        <Box component="main" sx={{ width: '100%', maxWidth: 400 }}>
          {/* Compact brand mark for small screens */}
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', mb: 5, color: 'primary.main' }}
          >
            <PlaceOutlined />
            <Typography sx={{ fontWeight: 650, color: 'text.primary' }}>Southampton City Council</Typography>
          </Stack>

          <Typography variant="overline" sx={{ color: 'primary.main' }}>
            Staff access
          </Typography>
          <Typography variant="h2" component="h1" sx={{ mt: 0.5, mb: 1 }}>
            Sign in to the admin portal
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Sign in with your admin username and password.
          </Typography>

          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Stack spacing={2.5}>
              {formError && (
                <Alert severity="error" variant="outlined" onClose={() => setFormError(null)}>
                  {formError}
                </Alert>
              )}

              <TextField
                label="Username"
                name="identifier"
                autoComplete="username"
                autoFocus
                fullWidth
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={Boolean(fieldErrors.identifier)}
                helperText={fieldErrors.identifier}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <TextField
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={Boolean(fieldErrors.password)}
                helperText={fieldErrors.password}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((s) => !s)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitting}
                sx={{ mt: 1 }}
              >
                {submitting ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 5 }}>
            This portal is for authorised council staff only.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
