export function roleLabel(role: string, translate: (key: string) => string) {
  if (role === 'SUPER_ADMIN') {
    return translate('access:roleSuperAdmin')
  }
  if (role === 'BUSINESS_OWNER') {
    return translate('access:roleBusinessOwner')
  }
  if (role === 'MARKETING') {
    return translate('access:roleMarketing')
  }
  if (role === 'SALESPERSON') {
    return translate('access:roleSalesperson')
  }
  return role
}
