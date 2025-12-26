import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState } from 'react'

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
  const [hasHydrated, setHasHydrated] = useState(false)

  useEffect(() => {
    // Check if already hydrated
    if (useAuthStore.persist.hasHydrated()) {
      setHasHydrated(true)
      return
    }

    // Wait for hydration to complete
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHasHydrated(true)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Show nothing while waiting for hydration
  if (!hasHydrated) {
    return null
  }

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
