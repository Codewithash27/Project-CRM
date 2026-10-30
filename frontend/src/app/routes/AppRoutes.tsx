import { Navigate, Route, Routes } from 'react-router-dom'

import { GuestRoute, PermissionRoute, ProtectedRoute } from '../../access/components/RouteGuards'
import { AccessDeniedPage } from '../../access/pages/AccessDeniedPage'
import { HomePage } from '../../access/pages/HomePage'
import { ProjectsPage } from '../../projects/pages/ProjectsPage'
import { RolesPage } from '../../roles/pages/RolesPage'
import { UsersPage } from '../../users/pages/UsersPage'
import { ForgotPasswordPage } from '../../auth/pages/ForgotPasswordPage'
import { LoginPage } from '../../auth/pages/LoginPage'
import { RegisterPage } from '../../auth/pages/RegisterPage'
import { ResetPasswordPage } from '../../auth/pages/ResetPasswordPage'
import { LoadingScreen } from '../../components/common/LoadingScreen'
import { NotFoundPage } from '../../components/common/NotFoundPage'
import { AppLayout } from '../../layouts/AppLayout/AppLayout'
import { AuthLayout } from '../../layouts/AuthLayout/AuthLayout'
import { NAV_ITEMS } from '../../layouts/AppLayout/nav'
import { NavPlaceholder } from '../../layouts/AppLayout/NavPlaceholder'
import { useAuth } from '../../store/auth-context'

function RootRedirect() {
  const { status } = useAuth()
  if (status === 'loading') {
    return <LoadingScreen />
  }
  return <Navigate to={status === 'authenticated' ? '/app' : '/login'} replace />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route
          path="users"
          element={
            <PermissionRoute permission="users.read">
              <UsersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="roles"
          element={
            <PermissionRoute permission="roles.read">
              <RolesPage />
            </PermissionRoute>
          }
        />
        <Route path="admin/access" element={<Navigate to="/app/users" replace />} />
        {NAV_ITEMS.filter(
          (item) => item.id !== 'home' && item.id !== 'users' && item.id !== 'roles' && item.id !== 'projects',
        ).map((item) => (
          <Route key={item.id} path={item.path.replace('/app/', '')} element={<NavPlaceholder id={item.id} />} />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
