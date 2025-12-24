import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'presenter' | 'participant'
}

/**
 * Route protection that allows both:
 * 1. Fully authenticated users (with JWT token)
 * 2. Anonymous participants (with device session token from join flow)
 *
 * This supports the user story: "Device Identity Binding" - participants
 * are tracked by device ID throughout the event, not by user account.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user, sessionToken } = useAuthStore()

  // Allow access if user is authenticated OR has a valid session token (anonymous participant)
  const hasAccess = isAuthenticated || !!sessionToken

  if (!hasAccess) {
    return <Navigate to="/login" replace />
  }

  // Role check only applies to authenticated users
  if (requiredRole && isAuthenticated && user?.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
