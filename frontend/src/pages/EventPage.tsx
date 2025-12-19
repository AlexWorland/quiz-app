import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { EventHostPage } from './EventHost'
import { EventParticipantPage } from './EventParticipant'
import { getSegment } from '@/api/endpoints'

export function EventPage() {
  const { eventId, segmentId } = useParams<{ eventId: string; segmentId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [isPresenter, setIsPresenter] = useState(false)
  const [loading, setLoading] = useState(true)

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
    try {
      setLoading(true)
      const res = await getSegment(eventId, segmentId)
      
      // Determine if current user is the presenter
      if (user && res.data.presenter_user_id) {
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

