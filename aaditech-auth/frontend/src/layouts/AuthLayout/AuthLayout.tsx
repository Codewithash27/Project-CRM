import { Box, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

import { LanguageSelect } from '../../components/common/LanguageSelect'

export function AuthLayout() {
  const { t } = useTranslation('auth')

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 2, sm: 3 },
        py: 4,
        backgroundColor: 'background.default',
        backgroundImage:
          'radial-gradient(900px 420px at -10% -20%, rgba(169, 120, 58, 0.2), transparent 55%), radial-gradient(720px 420px at 110% 120%, rgba(20, 50, 79, 0.16), transparent 50%)',
      }}
    >
      <Stack spacing={2} sx={{ width: '100%', maxWidth: 440 }}>
        <Typography variant="h6" component="p" textAlign="center">
          {t('appName')}
        </Typography>
        <LanguageSelect />
        <Paper data-testid="auth-card" sx={{ p: { xs: 2.5, sm: 4 }, width: '100%' }}>
          <Outlet />
        </Paper>
      </Stack>
    </Box>
  )
}
