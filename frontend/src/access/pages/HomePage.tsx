import { Box, Paper, Stack, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { roleLabel } from '../role-label'
import { useAuth } from '../../store/auth-context'
import { SECTIONS, primaryRole, visibleNav } from '../../layouts/AppLayout/nav'

export function HomePage() {
  const { t } = useTranslation(['navigation', 'access'])
  const { user } = useAuth()
  const roles = user?.roles ?? []
  const items = visibleNav(roles, user?.permissions ?? []).filter((item) => item.id !== 'home')
  const leadRole = primaryRole(roles)
  const introKey = leadRole ? `roleIntro.${leadRole}` : 'roleIntro.default'

  return (
    <Stack spacing={4}>
      <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
        <Typography variant="overline" sx={{ letterSpacing: '0.16em', color: 'secondary.dark', fontWeight: 700 }}>
          {t('navigation:workspace')}
        </Typography>
        <Typography variant="h1">{t('navigation:homeGreeting', { name: user?.full_name ?? '' })}</Typography>
        <Typography color="text.secondary" sx={{ fontSize: '1.05rem', lineHeight: 1.65 }}>
          {t(introKey, { defaultValue: t('navigation:roleIntro.default') })}
        </Typography>
        <Typography color="text.secondary">{t('navigation:homeLead')}</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 0.5 }}>
          {roles.map((role) => (
            <Box
              key={role}
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                fontSize: '0.82rem',
                fontWeight: 650,
              }}
            >
              {roleLabel(role, t)}
            </Box>
          ))}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        }}
      >
        {SECTIONS.map((section) => {
          const sectionItems = items.filter((item) => item.section === section)
          if (sectionItems.length === 0) return null
          return (
            <Paper
              key={section}
              variant="outlined"
              sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, bgcolor: 'background.paper' }}
            >
              <Typography variant="overline" sx={{ letterSpacing: '0.14em', color: 'text.secondary', fontWeight: 700 }}>
                {t(`navigation:sections.${section}`)}
              </Typography>
              <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, mt: 1.5, p: 0 }}>
                {sectionItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <Box component="li" key={item.id}>
                      <Box
                        component={Link}
                        to={item.path}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          minHeight: 48,
                          px: 1.25,
                          borderRadius: 2,
                          color: 'text.primary',
                          textDecoration: 'none',
                          '&:hover': { bgcolor: 'rgba(20, 50, 79, 0.05)' },
                        }}
                      >
                        <Icon fontSize="small" aria-hidden sx={{ color: 'primary.main' }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 650, lineHeight: 1.3 }}>
                            {t(`navigation:items.${item.id}`)}
                          </Typography>
                          {item.ready ? null : (
                            <Typography variant="caption" color="text.secondary">
                              {t('navigation:comingSoon')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  )
                })}
              </Stack>
            </Paper>
          )
        })}
      </Box>
    </Stack>
  )
}
