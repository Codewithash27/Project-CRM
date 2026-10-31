import { Button, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { homePathForRoles } from '../../layouts/AppLayout/nav'
import { useAuth } from '../../store/auth-context'

export function AccessDeniedPage() {
  const { t } = useTranslation('access')
  const { user } = useAuth()
  const home = homePathForRoles(user?.roles ?? [])
  return (
    <Stack spacing={2} role="alert">
      <Typography variant="h1">{t('deniedTitle')}</Typography>
      <Typography>{t('deniedMessage')}</Typography>
      <Button component={Link} to={home} variant="contained" sx={{ alignSelf: 'flex-start' }}>
        {t('backToApp')}
      </Button>
    </Stack>
  )
}
