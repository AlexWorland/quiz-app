import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { EventHostPage } from './EventHost'
import { EventParticipantPage } from './EventParticipant'
import { getSegment } from '@/api/endpoints'

export function EventPage() {
  const { eventId, segmentId } = useParams<{ eventId: string; segmentId?: string }>()
  const navigate = useNavigate()
  const { user, sessionToken } = useAuthStore()
  const [isPresenter, setIsPresenter] = useState(false)
  const [loading, setLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!eventId || !segmentId) {
      // If no segmentId, redirect to event detail page
      navigate(`/events/${eventId}`)
      return
    }
    void loadSegment()
  }, [eventId, segmentId])

  const loadSegment = async () => {
    if (!eventId || !segmentId) return
    
    // Wait for auth store to rehydrate from localStorage
    const authStore = useAuthStore.getState()
    console.log('[EventPage] loadSegment called:', { 
      retryCount, 
      isAuthenticated: authStore.isAuthenticated,
      hasToken: !!authStore.token,
      hasSessionToken: !!authStore.sessionToken
    })
    
    if (!authStore.isAuthenticated && !authStore.sessionToken && !authStore.token) {
      // Retry up to 50 times (5 seconds total) to allow auth store to rehydrate
      if (retryCount < 50) {
        console.log('[EventPage] Auth not ready, retrying...', retryCount + 1)
        setRetryCount(prev => prev + 1)
        setTimeout(() => void loadSegment(), 100)
        return
      } else {
        console.error('[EventPage] Auth never became ready after 50 retries')
        navigate('/login')
        return
      }
    }
    
    try {
      setLoading(true)
      console.log('[EventPage] Fetching segment:', { eventId, segmentId })
      const res = await getSegment(eventId, segmentId)
      console.log('[EventPage] Segment loaded:', { 
        status: res.data.status, 
        previous_status: res.data.previous_status 
      })
      
      // Check if user has a participant session (device session)
      const hasParticipantSession = !!authStore.sessionToken
      
      // If user has participant session, show participant view even if they're the presenter
      // This allows host to participate in their own event
      if (hasParticipantSession) {
        setIsPresenter(false)
      } else if (user && res.data.presenter_user_id) {
        // Otherwise, check if they're assigned as presenter
        setIsPresenter(res.data.presenter_user_id === user.id)
      } else {
        setIsPresenter(false)
      }
    } catch (error) {
      console.error('Failed to load segment:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  // For now, delegate to existing pages based on role
  // Full unification would require extracting shared logic
  if (isPresenter) {
    return <EventHostPage />
  } else {
    return <EventParticipantPage />
  }
}

