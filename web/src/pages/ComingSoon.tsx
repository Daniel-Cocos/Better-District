import { Link as RouterLink, useLocation } from 'react-router'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { navItems } from '../components/navItems'

/** Placeholder for sections that will be built in later chunks. */
export default function ComingSoon() {
  const { pathname } = useLocation()
  const label = navItems.find((n) => n.to === pathname)?.label ?? (pathname === '/settings' ? 'Settings' : 'This section')

  return (
    <Paper variant="outlined" sx={{ maxWidth: 560, mx: 'auto', mt: { xs: 2, md: 6 }, p: { xs: 3, sm: 5 }, textAlign: 'center' }}>
      <Typography variant="overline" sx={{ color: 'primary.main' }}>
        Coming soon
      </Typography>
      <Typography variant="h2" component="h1" sx={{ mt: 0.5, mb: 1 }}>
        {label}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        This part of the admin portal hasn’t been built yet.
      </Typography>
      <Button component={RouterLink} to="/" variant="outlined">
        Back to overview
      </Button>
    </Paper>
  )
}
