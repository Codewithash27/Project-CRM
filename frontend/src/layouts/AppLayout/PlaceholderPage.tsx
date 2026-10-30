import { Box, Chip, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NavItem } from './nav'

export function PlaceholderPage({ item }: { item: NavItem }) {
  const { t } = useTranslation('navigation')
  const Icon = item.icon

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Chip
        label={t('comingSoon')}
        sx={{
          alignSelf: 'flex-start',
          bgcolor: 'rgba(169, 120, 58, 0.12)',
          color: '#7A5420',
          fontWeight: 650,
          letterSpacing: '0.04em',
        }}
      />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            color: 'primary.main',
            bgcolor: 'rgba(20, 50, 79, 0.06)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Icon aria-hidden />
        </Box>
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.16em' }}>
            {t(`sections.${item.section}`)}
          </Typography>
          <Typography variant="h1">{t(`items.${item.id}`)}</Typography>
        </Stack>
      </Stack>
      <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.6 }}>{t(`hints.${item.id}`)}</Typography>
      <Box
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography color="text.secondary">{t('placeholderLead')}</Typography>
      </Box>
    </Stack>
  )
}
