import { Box, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { APP_VERSION_LABEL } from '../../config/version'

const points = ['heroPointOwners', 'heroPointAdmins', 'heroPointSales'] as const

function LogoMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 38,
        height: 38,
        borderRadius: '11px',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.3)',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="2.5" width="6" height="8" rx="1.5" />
        <rect x="11.5" y="2.5" width="6" height="5" rx="1.5" />
        <rect x="11.5" y="10.5" width="6" height="7" rx="1.5" />
        <rect x="2.5" y="13.5" width="6" height="4" rx="1.5" />
      </svg>
    </Box>
  )
}

export function AuthLayout() {
  const { t } = useTranslation('auth')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(320px, 42%) minmax(0, 1fr)' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        component="section"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { md: 'center' },
          gap: { xs: 1.5, md: 2.5 },
          p: { xs: '22px 20px 20px', md: '56px 48px' },
          background: 'linear-gradient(150deg, #172554 0%, #1d4ed8 55%, #6366f1 100%)',
          '&::before, &::after': {
            content: '""',
            position: 'absolute',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
          },
          '&::before': { width: 340, height: 340, right: -120, top: -110 },
          '&::after': { width: 260, height: 260, left: -90, bottom: -90, background: 'rgba(255,255,255,0.06)' },
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 17 }}>
          <LogoMark />
          <span>{t('appName')}</span>
        </Stack>
        <Typography
          component="h1"
          sx={{
            position: 'relative',
            zIndex: 1,
            m: 0,
            color: '#fff',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            fontSize: { xs: 22, md: 'clamp(26px, 3.2vw, 38px)' },
          }}
        >
          {t('heroTitleLine1')}
          <br />
          {t('heroTitleLine2')}
        </Typography>
        <Typography sx={{ position: 'relative', zIndex: 1, m: 0, color: '#dbeafe', maxWidth: '36ch', lineHeight: 1.5 }}>
          {t('heroLead')}
        </Typography>
        <Box
          component="ul"
          sx={{
            display: { xs: 'none', md: 'grid' },
            position: 'relative',
            zIndex: 1,
            listStyle: 'none',
            p: 0,
            m: 0,
            gap: 1.5,
            fontSize: 14,
            color: '#e0e7ff',
            lineHeight: 1.45,
          }}
        >
          {points.map((key) => (
            <Box key={key} component="li" sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Box
                aria-hidden
                sx={{
                  flex: 'none',
                  width: 18,
                  height: 18,
                  mt: '2px',
                  borderRadius: '50%',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5.5 10.5l3 3 6-7'/%3E%3C/svg%3E\")",
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '12px',
                }}
              />
              <span>{t(key)}</span>
            </Box>
          ))}
        </Box>
        <Typography
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'relative',
            zIndex: 1,
            mt: 'auto',
            pt: 4,
            m: 0,
            fontSize: 12,
            color: 'rgba(219, 234, 254, 0.72)',
            letterSpacing: '0.02em',
          }}
        >
          {t('releaseVersion', { version: APP_VERSION_LABEL })}
        </Typography>
      </Box>

      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: '24px 16px 28px', md: '48px 40px' },
        }}
      >
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 420 }}>
          <Paper
            data-testid="auth-card"
            variant="outlined"
            sx={{
              width: '100%',
              borderRadius: '16px',
              p: { xs: 3, sm: 4 },
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
            }}
          >
            <Outlet />
          </Paper>
          <Typography
            component="p"
            textAlign="center"
            sx={{ m: 0, fontSize: 12, color: 'text.secondary', letterSpacing: '0.02em' }}
          >
            {t('releaseVersion', { version: APP_VERSION_LABEL })}
          </Typography>
        </Stack>
      </Box>
    </Box>
  )
}
