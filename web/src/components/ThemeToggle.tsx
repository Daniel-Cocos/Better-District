import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import { useColorMode } from '../colorMode/ColorModeContext'

/** Sun in light mode, moon in dark mode — the two icons spin past each other on switch. */
export default function ThemeToggle() {
  const { mode, toggle } = useColorMode()
  const dark = mode === 'dark'
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme'

  const icon = (visible: boolean, turn: number) => ({
    position: 'absolute',
    inset: 0,
    opacity: visible ? 1 : 0,
    transform: visible ? 'rotate(0deg) scale(1)' : `rotate(${turn}deg) scale(0.4)`,
    transition: 'transform 320ms cubic-bezier(.4,0,.2,1), opacity 200ms ease',
    '@media (prefers-reduced-motion: reduce)': { transition: 'opacity 150ms ease', transform: 'none' },
  })

  return (
    <Tooltip title={label}>
      <IconButton onClick={toggle} aria-label={label} sx={{ color: 'text.secondary' }}>
        <Box sx={{ position: 'relative', width: 22, height: 22, '& svg': { fontSize: 22, display: 'block' } }}>
          <Box sx={icon(!dark, -90)}>
            <LightModeOutlined />
          </Box>
          <Box sx={icon(dark, 90)}>
            <DarkModeOutlined />
          </Box>
        </Box>
      </IconButton>
    </Tooltip>
  )
}
