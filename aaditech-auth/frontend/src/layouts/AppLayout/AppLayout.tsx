import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined'
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { roleLabel } from '../../access/role-label'
import { useAuth } from '../../store/auth-context'
import { SidebarNav } from './SidebarNav'
import { isNavActive, primaryRole, visibleNav } from './nav'

const EXPANDED = 280
const COLLAPSED = 84

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'A'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function AppLayout() {
  const { t } = useTranslation(['navigation', 'auth', 'access'])
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [accountAnchor, setAccountAnchor] = useState<null | HTMLElement>(null)
  const sidebarWidth = desktop && collapsed ? COLLAPSED : EXPANDED
  const items = visibleNav(user?.roles ?? [], user?.permissions ?? [])
  const current = items.find((item) => isNavActive(pathname, item))
  const leadRole = primaryRole(user?.roles ?? [])

  async function onLogout() {
    setAccountAnchor(null)
    await logout()
    navigate('/login', { replace: true })
  }

  const drawerPaper = {
    width: sidebarWidth,
    boxSizing: 'border-box' as const,
    color: '#F4F0E8',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    background: 'linear-gradient(180deg, #16202B 0%, #101820 48%, #0C1218 100%)',
    overflowX: 'hidden' as const,
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      <Button
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 16,
          top: -48,
          zIndex: theme.zIndex.tooltip + 1,
          '&:focus': { top: 16 },
        }}
      >
        {t('navigation:skipToContent')}
      </Button>

      <Drawer
        variant="temporary"
        open={mobileOpen && !desktop}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { ...drawerPaper, width: EXPANDED },
        }}
      >
        <SidebarNav collapsed={false} showCollapse={false} onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          width: sidebarWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            ...drawerPaper,
            transition: theme.transitions.create('width', { duration: 180 }),
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        }}
      >
        <SidebarNav
          collapsed={collapsed}
          showCollapse
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </Drawer>

      <Stack sx={{ flex: 1, minWidth: 0, height: '100vh' }}>
        <AppBar
          position="static"
          color="inherit"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255, 252, 248, 0.92)',
            borderBottom: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: { xs: 68, md: 76 }, px: { xs: 1.5, sm: 2.5 } }}>
            <IconButton
              edge="start"
              aria-label={mobileOpen ? t('navigation:closeMenu') : t('navigation:openMenu')}
              onClick={() => setMobileOpen((open) => !open)}
              sx={{ display: { md: 'none' } }}
            >
              {mobileOpen ? <CloseOutlinedIcon /> : <MenuOutlinedIcon />}
            </IconButton>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                sx={{ display: 'block', letterSpacing: '0.14em', color: 'text.secondary', fontWeight: 650 }}
              >
                {current ? t(`navigation:sections.${current.section}`) : t('navigation:workspace')}
              </Typography>
              <Typography noWrap sx={{ fontWeight: 650, fontSize: '1.05rem' }}>
                {current ? t(`navigation:items.${current.id}`) : t('auth:appName')}
              </Typography>
            </Box>
            <Button
              color="inherit"
              aria-haspopup="menu"
              aria-expanded={accountAnchor ? true : undefined}
              aria-controls={accountAnchor ? 'account-menu' : undefined}
              aria-label={t('navigation:accountMenu')}
              onClick={(event) => setAccountAnchor(event.currentTarget)}
              sx={{ color: 'text.primary', px: 1, minWidth: 0 }}
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: '0.8rem', fontWeight: 700 }}>
                {initials(user?.full_name ?? '')}
              </Avatar>
              <Box sx={{ display: { xs: 'none', lg: 'block' }, textAlign: 'left', ml: 1.25, minWidth: 0 }}>
                <Typography noWrap variant="body2" sx={{ fontWeight: 700, maxWidth: 160 }}>
                  {user?.full_name}
                </Typography>
                <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 160 }}>
                  {leadRole ? roleLabel(leadRole, t) : ''}
                </Typography>
              </Box>
            </Button>
            <Menu
              id="account-menu"
              anchorEl={accountAnchor}
              open={Boolean(accountAnchor)}
              onClose={() => setAccountAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled sx={{ opacity: '1 !important', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {user?.full_name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </MenuItem>
              <MenuItem onClick={() => void onLogout()}>{t('auth:logout')}</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box
          id="main-content"
          component="main"
          sx={{ flex: 1, overflow: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 2.5, md: 3.5 } }}
        >
          <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
            <Outlet />
          </Box>
        </Box>
      </Stack>
    </Box>
  )
}
