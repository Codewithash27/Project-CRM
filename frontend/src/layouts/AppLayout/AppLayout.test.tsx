import { ThemeProvider } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HomePage } from '../../access/pages/HomePage'
import type { UserProfile } from '../../auth/types'
import { AuthContext } from '../../store/auth-context'
import { theme } from '../../theme/theme'
import { AppLayout } from './AppLayout'
import { NavPlaceholder } from './NavPlaceholder'

vi.mock('../../services/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  ensureCsrf: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}))

function profile(roles: string[], permissions: string[] = ['features.read']): UserProfile {
  return {
    id: 'user-id',
    full_name: 'Asha Kale',
    email: 'asha@example.com',
    preferred_language: 'en',
    is_active: true,
    email_verified: true,
    company_id: 'company-id',
    team_id: null,
    manager_id: null,
    roles,
    permissions,
  }
}

function renderShell(user: UserProfile, path = '/app') {
  return render(
    <ThemeProvider theme={theme}>
      <AuthContext.Provider
        value={{
          status: 'authenticated',
          user,
          login: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
          refreshUser: vi.fn(),
        }}
      >
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<HomePage />} />
              <Route path="leads" element={<NavPlaceholder id="leads" />} />
              <Route path="businesses" element={<NavPlaceholder id="businesses" />} />
              <Route path="access-denied" element={<div>Denied</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>,
  )
}

describe('AppLayout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  })

  it('shows a salesperson the lead menu and hides business setup', () => {
    renderShell(profile(['SALESPERSON']))
    expect(screen.getByRole('link', { name: 'Reminders' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Follow-ups' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Businesses' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Team' })).not.toBeInTheDocument()
  })

  it('opens a holding screen from the sidebar', async () => {
    renderShell(profile(['SALESPERSON']))
    await userEvent.click(screen.getByRole('link', { name: 'Leads' }))
    expect(await screen.findByText('Coming next')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument()
  })

  it('keeps a platform screen away from a salesperson', () => {
    renderShell(profile(['SALESPERSON']), '/app/businesses')
    expect(screen.getByText('Denied')).toBeInTheDocument()
  })
})
