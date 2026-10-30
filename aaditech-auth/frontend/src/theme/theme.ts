import { createTheme } from '@mui/material/styles'

const sans = '"Outfit", "Noto Sans Devanagari", "Segoe UI", sans-serif'
const display = '"Fraunces", "Noto Sans Devanagari", Georgia, serif'

const focusRing = {
  '&:focus-visible': {
    outline: '3px solid #C5923E',
    outlineOffset: '2px',
  },
}

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#14324F', dark: '#0C1E30', light: '#3E6280' },
    secondary: { main: '#A9783A', dark: '#7A5420', light: '#C5923E' },
    background: { default: '#F3F0EA', paper: '#FFFCF8' },
    text: { primary: '#1A1814', secondary: '#5C564C' },
    divider: '#E4DDD2',
    error: { main: '#9C2F2F' },
  },
  typography: {
    fontFamily: sans,
    h1: { fontFamily: display, fontSize: 'clamp(1.85rem, 2.4vw, 2.35rem)', fontWeight: 560, letterSpacing: '-0.03em', lineHeight: 1.15 },
    h2: { fontFamily: display, fontSize: '1.5rem', fontWeight: 560, letterSpacing: '-0.02em' },
    h6: { fontFamily: display, fontWeight: 560 },
    button: { fontFamily: sans, fontWeight: 650 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 650, minHeight: 44, ...focusRing },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { ...focusRing } } },
    MuiLink: { styleOverrides: { root: focusRing } },
    MuiListItemButton: { styleOverrides: { root: focusRing } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { margin: 0, backgroundColor: '#F3F0EA' },
      },
    },
  },
})
