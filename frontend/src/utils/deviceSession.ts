/**
 * Device session management utilities to prevent accidental multi-event joins
 * and provide clear feedback when device conflicts occur.
 */

interface DeviceSession {
  eventId: string
  eventTitle: string
  joinedAt: string
  sessionToken?: string
}

const DEVICE_SESSION_KEY = 'current_device_session'

/**
 * Store current event session for this device
 */
export function setCurrentEventSession(eventId: string, eventTitle: string, sessionToken?: string) {
  const session: DeviceSession = {
    eventId,
    eventTitle,
    joinedAt: new Date().toISOString(),
    sessionToken,
  }
  localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(session))
}

/**
 * Get current event session for this device
 */
export function getCurrentEventSession(): DeviceSession | null {
  try {
    const sessionStr = localStorage.getItem(DEVICE_SESSION_KEY)
    if (!sessionStr) return null
    return JSON.parse(sessionStr)
  } catch {
    return null
  }
}

/**
 * Clear current event session
 */
export function clearCurrentEventSession() {
  localStorage.removeItem(DEVICE_SESSION_KEY)
}

/**
 * Check if device is currently in an event
 */
export function isDeviceInEvent(eventId?: string): boolean {
  const session = getCurrentEventSession()
  if (!session) return false
  if (eventId) {
    return session.eventId === eventId
  }
  return true
}

/**
 * Get conflict information for error display
 */
export function getEventConflictInfo(): { eventId: string; eventTitle: string; joinedAt: Date } | null {
  const session = getCurrentEventSession()
  if (!session) return null
  
  return {
    eventId: session.eventId,
    eventTitle: session.eventTitle,
    joinedAt: new Date(session.joinedAt),
  }
}

/**
 * Validate if a new event join should be allowed
 */
export function validateEventJoin(newEventId: string): {
  allowed: boolean
  conflict?: { eventId: string; eventTitle: string; joinedAt: Date }
} {
  const session = getCurrentEventSession()
  
  if (!session) {
    return { allowed: true }
  }
  
  if (session.eventId === newEventId) {
    // Same event - this is a rejoin, which is allowed
    return { allowed: true }
  }
  
  // Different event - this is a conflict
  return {
    allowed: false,
    conflict: {
      eventId: session.eventId,
      eventTitle: session.eventTitle,
      joinedAt: new Date(session.joinedAt),
    }
  }
}

/**
 * Force leave current event (for conflict resolution)
 */
export async function leaveCurrentEvent(): Promise<void> {
  const session = getCurrentEventSession()
  if (!session) return
  
  // TODO: Add API call to leave event if backend supports it
  // For now, just clear local session
  clearCurrentEventSession()
}

/**
 * Get formatted duration since joining current event
 */
export function getCurrentEventDuration(): string | null {
  const session = getCurrentEventSession()
  if (!session) return null
  
  const joinedAt = new Date(session.joinedAt)
  const minutes = Math.floor((Date.now() - joinedAt.getTime()) / 60000)
  
  if (minutes < 1) return 'just joined'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  return `${hours} hours ago`
}
