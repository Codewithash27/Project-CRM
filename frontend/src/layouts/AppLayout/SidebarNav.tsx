import {
  Avatar,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import MenuOpenOutlinedIcon from '@mui/icons-material/MenuOpenOutlined'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useLocation } from 'react-router-dom'

import { roleLabel } from '../../access/role-label'
import { useAuth } from '../../store/auth-context'
import { SECTIONS, isNavActive, primaryRole, visibleNav, type NavItem } from './nav'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function NavButton({
  item,
  label,
  collapsed,
  active,
  onNavigate,
}: {
  item: NavItem
  label: string
  collapsed: boolean
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const button = (
    <ListItemButton
      component={RouterLink}
      to={item.path}
      selected={active}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      onClick={onNavigate}
      sx={{
        minHeight: 44,
        borderRadius: 2,
        mb: 0.25,
        px: collapsed ? 1.25 : 1.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: active ? '#F6E7C8' : 'rgba(244, 240, 232, 0.78)',
        '&.Mui-selected': {
          bgcolor: 'rgba(169, 120, 58, 0.18)',
          color: '#F6E7C8',
        },
        '&.Mui-selected:hover': { bgcolor: 'rgba(169, 120, 58, 0.26)' },
        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: collapsed ? 0 : 36,
          color: active ? '#E4C48A' : 'rgba(244, 240, 232, 0.62)',
          justifyContent: 'center',
        }}
      >
        <Icon fontSize="small" aria-hidden />
      </ListItemIcon>
      {collapsed ? null : (
        <ListItemText
          primary={label}
          slotProps={{ primary: { sx: { fontWeight: active ? 650 : 500, fontSize: '0.94rem' } } }}
        />
      )}
    </ListItemButton>
  )

  if (!collapsed) return button
  return (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  )
}

export function SidebarNav({
  collapsed,
  showCollapse,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed: boolean
  showCollapse: boolean
  onToggleCollapse?: () => void
  onNavigate?: () => void
}) {
  const { t } = useTranslation(['navigation', 'access'])
  const { user } = useAuth()
  const { pathname } = useLocation()
  const items = visibleNav(user?.roles ?? [], user?.permissions ?? [])
  const roleNames = user?.roles.map((role) => roleLabel(role, t)).join(', ')
  const leadRole = primaryRole(user?.roles ?? [])

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: collapsed ? 1.25 : 2, minHeight: 76 }}>
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#C5923E',
            color: '#1C1408',
            fontFamily: '"Fraunces", "Noto Sans Devanagari", Georgia, serif',
            fontWeight: 650,
            fontSize: '1.25rem',
          }}
        >
          A
        </Box>
        {collapsed ? null : (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              component={RouterLink}
              to="/app"
              onClick={onNavigate}
              sx={{
                display: 'block',
                color: 'inherit',
                textDecoration: 'none',
                fontFamily: '"Fraunces", "Noto Sans Devanagari", Georgia, serif',
                fontWeight: 560,
                fontSize: '1.25rem',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {t('navigation:brand')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(244,240,232,0.55)', letterSpacing: '0.16em' }}>
              {t('navigation:product')}
            </Typography>
          </Box>
        )}
        {showCollapse ? (
          <IconButton
            aria-label={collapsed ? t('navigation:expandSidebar') : t('navigation:collapseSidebar')}
            onClick={onToggleCollapse}
            sx={{ color: 'rgba(244,240,232,0.8)' }}
          >
            {collapsed ? <MenuOutlinedIcon /> : <MenuOpenOutlinedIcon />}
          </IconButton>
        ) : null}
      </Stack>

      <Box component="nav" aria-label={t('navigation:mainNavigation')} sx={{ flex: 1, overflowY: 'auto', px: 1.25, pb: 2 }}>
        {SECTIONS.map((section) => {
          const sectionItems = items.filter((item) => item.section === section)
          if (sectionItems.length === 0) return null
          const showHeading = items.some((item) => item.section !== section)
          return (
            <Box key={section} sx={{ mb: 1.5 }}>
              {collapsed || !showHeading ? null : (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    px: 1.5,
                    pt: 1.25,
                    pb: 0.75,
                    color: 'rgba(244,240,232,0.42)',
                    letterSpacing: '0.14em',
                    fontWeight: 650,
                  }}
                >
                  {t(`navigation:sections.${section}`)}
                </Typography>
              )}
              <List disablePadding>
                {sectionItems.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    label={t(`navigation:items.${item.id}`)}
                    collapsed={collapsed}
                    active={isNavActive(pathname, item)}
                    onNavigate={onNavigate}
                  />
                ))}
              </List>
            </Box>
          )
        })}
      </Box>

      <Box sx={{ px: collapsed ? 1.25 : 2, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: '#C5923E',
              color: '#1C1408',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            {initials(user?.full_name ?? '')}
          </Avatar>
          {collapsed ? null : (
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 650, fontSize: '0.92rem' }}>
                {user?.full_name}
              </Typography>
              <Typography noWrap variant="caption" sx={{ color: 'rgba(244,240,232,0.55)' }}>
                {leadRole ? roleLabel(leadRole, t) : roleNames}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>
    </Stack>
  )
}
