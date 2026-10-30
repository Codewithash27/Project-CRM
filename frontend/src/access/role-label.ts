const ROLE_KEYS: Record<string, string> = {
  SUPER_ADMIN: 'access:roleSuperAdmin',
  BUSINESS_OWNER: 'access:roleBusinessOwner',
  MARKETING: 'access:roleMarketing',
  SALESPERSON: 'access:roleSalesperson',
  ADMIN: 'access:roleAdmin',
  SALES_MANAGER: 'access:roleSalesManager',
  SALES_REP: 'access:roleSalesRep',
  VIEWER: 'access:roleViewer',
}

export function roleLabel(role: string, translate: (key: string) => string) {
  const key = ROLE_KEYS[role]
  return key ? translate(key) : role
}
