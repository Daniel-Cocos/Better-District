import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider, type PaletteMode } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { createAppTheme } from '../theme'

const STORAGE_KEY = 'colorMode'

interface ColorModeValue {
  mode: PaletteMode
  toggle: () => void
}

const ColorModeContext = createContext<ColorModeValue | null>(null)

// A saved choice wins; otherwise follow the operating system
function initialMode(): PaletteMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // storage unavailable (private window etc.)
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(initialMode)
  const theme = useMemo(() => createAppTheme(mode), [mode])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // not persisted, still works for this visit
    }
  }, [mode])

  const value = useMemo(() => ({ mode, toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')) }), [mode])

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useColorMode() {
  const ctx = useContext(ColorModeContext)
  if (!ctx) throw new Error('useColorMode must be used inside ColorModeProvider')
  return ctx
}
