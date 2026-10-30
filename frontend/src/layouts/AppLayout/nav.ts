import type { SvgIconComponent } from '@mui/icons-material'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined'
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined'
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import WorkOutlineOutlinedIcon from '@mui/icons-material/WorkOutlineOutlined'

export const SECTIONS = ['menu'] as const
export type NavSection = (typeof SECTIONS)[number]

const SUPER_ADMIN = ['SUPER_ADMIN'] as const
const OWNER = ['BUSINESS_OWNER', 'ADMIN'] as const
const SALES = ['SALESPERSON', 'SALES_REP', 'SALES_MANAGER'] as const
const MARKETING = ['MARKETING'] as const

const ROLE_RANK = [
  'SUPER_ADMIN',
  'ADMIN',
  'BUSINESS_OWNER',
  'SALES_MANAGER',
  'SALES_REP',
  'SALESPERSON',
  'MARKETING',
  'VIEWER',
] as const

export type NavItem = {
  id: string
  path: string
  section: NavSection
  roles: readonly string[]
  permission?: string
  always?: boolean
  ready?: boolean
  icon: SvgIconComponent
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'businesses', path: '/app/businesses', section: 'menu', roles: SUPER_ADMIN, icon: DomainOutlinedIcon },
  { id: 'home', path: '/app', section: 'menu', roles: OWNER, icon: HomeOutlinedIcon },
  { id: 'projects', path: '/app/projects', section: 'menu', roles: [...SUPER_ADMIN, ...OWNER], ready: true, icon: WorkOutlineOutlinedIcon },
  {
    id: 'users',
    path: '/app/users',
    section: 'menu',
    roles: SUPER_ADMIN,
    ready: true,
    icon: PeopleAltOutlinedIcon,
  },
  {
    id: 'roles',
    path: '/app/roles',
    section: 'menu',
    roles: SUPER_ADMIN,
    ready: true,
    icon: ManageAccountsOutlinedIcon,
  },
  { id: 'team', path: '/app/team', section: 'menu', roles: OWNER, icon: GroupsOutlinedIcon },
  { id: 'reminders', path: '/app/reminders', section: 'menu', roles: SALES, icon: TodayOutlinedIcon },
  { id: 'leads', path: '/app/leads', section: 'menu', roles: [...OWNER, ...SALES], icon: PersonSearchOutlinedIcon },
  { id: 'leadFields', path: '/app/lead-fields', section: 'menu', roles: [...OWNER, ...SALES], icon: TuneOutlinedIcon },
  { id: 'pipeline', path: '/app/pipeline', section: 'menu', roles: [...OWNER, ...SALES], icon: AccountTreeOutlinedIcon },
  { id: 'followUps', path: '/app/follow-ups', section: 'menu', roles: [...OWNER, ...SALES], icon: TaskAltOutlinedIcon },
  { id: 'kpis', path: '/app/kpis', section: 'menu', roles: [...OWNER, ...SALES], icon: AssessmentOutlinedIcon },
  { id: 'campaigns', path: '/app/campaigns', section: 'menu', roles: MARKETING, icon: CampaignOutlinedIcon },
]

export function primaryRole(roles: readonly string[]): string | null {
  return ROLE_RANK.find((role) => roles.includes(role)) ?? roles[0] ?? null
}

export function visibleNav(roles: readonly string[], permissions: readonly string[] = []): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.always) return true
    if (item.roles.some((role) => roles.includes(role))) return true
    return item.permission ? permissions.includes(item.permission) : false
  })
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.id === 'home') return pathname === '/app' || pathname === '/app/'
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}
