import { describe, expect, it } from 'vitest'

import { visibleNav } from './nav'

function ids(roles: string[], permissions: string[] = []) {
  return visibleNav(roles, permissions).map((item) => item.id)
}

describe('visibleNav', () => {
  it('gives a salesperson their lead menu and hides setup', () => {
    expect(ids(['SALESPERSON'])).toEqual([
      'reminders',
      'leads',
      'leadFields',
      'pipeline',
      'followUps',
      'kpis',
    ])
    expect(ids(['SALES_REP'])).toEqual(ids(['SALESPERSON']))
  })

  it('gives a business owner the team and a view of every lead', () => {
    expect(ids(['BUSINESS_OWNER'])).toEqual([
      'home',
      'projects',
      'team',
      'leads',
      'leadFields',
      'pipeline',
      'followUps',
      'kpis',
    ])
  })

  it('gives a super admin businesses, projects, users, and roles', () => {
    expect(ids(['SUPER_ADMIN'])).toEqual(['businesses', 'projects', 'users', 'roles'])
  })

  it('gives marketing campaigns only', () => {
    expect(ids(['MARKETING'])).toEqual(['campaigns'])
  })

  it('does not add setup menus because a salesperson can read users', () => {
    expect(ids(['SALESPERSON'], ['users.read'])).not.toContain('users')
    expect(ids(['SALESPERSON'], ['users.read'])).not.toContain('businesses')
  })
})
