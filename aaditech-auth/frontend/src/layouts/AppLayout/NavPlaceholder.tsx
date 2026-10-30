import { Navigate } from 'react-router-dom'

import { NotFoundPage } from '../../components/common/NotFoundPage'
import { useAuth } from '../../store/auth-context'
import { NAV_ITEMS, visibleNav } from './nav'
import { PlaceholderPage } from './PlaceholderPage'

export function NavPlaceholder({ id }: { id: string }) {
  const { user } = useAuth()
  const item = NAV_ITEMS.find((entry) => entry.id === id)
  if (!item) return <NotFoundPage />
  const allowed = visibleNav(user?.roles ?? [], user?.permissions ?? []).some((entry) => entry.id === id)
  if (!allowed) return <Navigate to="/app/access-denied" replace />
  return <PlaceholderPage item={item} />
}
