import { createTheme, alpha, lighten, type PaletteMode, type Theme } from '@mui/material/styles'

/**
 * Colour "waves" — swap ACTIVE_WAVE to try a different palette across the whole app.
 * Each wave has a light and dark variant; every page pulls from the theme, so nothing else needs to change.
 */
const waves = {
  // Off-white ground with a soft harbour blue
  harbour: {
    light: {
      primary: '#3E6FA8',
      primaryLight: '#E6EEF8',
      primaryDark: '#2E5A8C',
      background: '#F6F7F9',
      paper: '#FFFFFF',
      text: '#1C2733',
      textSecondary: '#5B6876',
      divider: '#E1E5EA',
      error: '#B3261E',
    },
    // Deep harbour night, with the blue lifted so it reads on dark surfaces
    dark: {
      primary: '#7FA8DA',
      primaryLight: '#1D2B3B',
      primaryDark: '#2B5079',
      background: '#0F141A',
      paper: '#161C24',
      text: '#E6EBF1',
      textSecondary: '#9AA6B4',
      divider: '#262E39',
      error: '#F2B8B5',
    },
  },
  // Crisp white with a lighter, airier blue
  clear: {
    light: {
      primary: '#4A86C5',
      primaryLight: '#EBF3FB',
      primaryDark: '#356BA3',
      background: '#FFFFFF',
      paper: '#FFFFFF',
      text: '#18222D',
      textSecondary: '#5E6B78',
      divider: '#E4E8EC',
      error: '#B3261E',
    },
    dark: {
      primary: '#86B4E6',
      primaryLight: '#1B2C3E',
      primaryDark: '#2E5A8A',
      background: '#0D1117',
      paper: '#151B23',
      text: '#E8EDF2',
      textSecondary: '#9BA7B3',
      divider: '#252D37',
      error: '#F2B8B5',
    },
  },
} as const

export type Wave = keyof typeof waves
export const ACTIVE_WAVE: Wave = 'harbour'

/** Solid brand blue for surfaces carrying white text; dark mode's lifted primary is too pale for that. */
export const brandBlue = (t: Theme) => (t.palette.mode === 'dark' ? t.palette.primary.dark : t.palette.primary.main)

/** Background + foreground for a tinted badge, so pale light-mode tints don't glare in dark mode. */
export const tint = (t: Theme, accent: string, soft: string) =>
  t.palette.mode === 'dark'
    ? { bgcolor: alpha(accent, 0.2), color: lighten(accent, 0.45) }
    : { bgcolor: soft, color: accent }

export function createAppTheme(mode: PaletteMode = 'light', wave: Wave = ACTIVE_WAVE) {
  const c = waves[wave][mode]

  return createTheme({
    palette: {
      mode,
      primary: {
        main: c.primary,
        light: c.primaryLight,
        dark: c.primaryDark,
        contrastText: mode === 'dark' ? '#0F1A26' : '#FFFFFF',
      },
      background: { default: c.background, paper: c.paper },
      text: { primary: c.text, secondary: c.textSecondary },
      divider: c.divider,
      error: { main: c.error },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h1: { fontSize: '2.25rem', fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h2: { fontSize: '1.625rem', fontWeight: 650, letterSpacing: '-0.015em' },
      body1: { fontSize: '0.975rem', lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
      overline: { fontWeight: 600, letterSpacing: '0.12em' },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 10, paddingBlock: 11 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.paper,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.divider },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(c.primary, 0.5) },
            '&.Mui-focused': { boxShadow: `0 0 0 4px ${alpha(c.primary, 0.12)}` },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: '0.95rem' } },
      },
      MuiPaper: {
        styleOverrides: { rounded: { borderRadius: 16 } },
      },
    },
  })
}
