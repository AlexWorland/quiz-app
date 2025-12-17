import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/common/Input'
import { Button } from '@/components/common/Button'
import { eventAPI, type Event, type Segment } from '@/api/endpoints'
import { useAuthStore } from '@/store/authStore'

// Extended event type that may include segments
interface EventWithSegments extends Event {
  segments?: Segment[]
}

export function JoinEventPage() {
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    const pref = searchParams.get('code')
    if (pref) {
      setCode(pref.toUpperCase())
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    try {
      setLoading(true)
      setError(null)
      const cleaned = code.trim().toUpperCase()
      const res = await eventAPI.getByJoinCode(cleaned)
      const event = res.data as EventWithSegments

      // Check if user is the host
      const isHost = user && event.host_id === user.id

      if (isHost) {
        // Host goes to event management page
        navigate(`/events/${event.id}`)
      } else {
        // Participant: try to find an active segment or use the first one
        const segments = event.segments || []
        const activeSegment = segments.find(
          (s) => s.status === 'recording' || s.status === 'quizzing' || s.status === 'quiz_ready'
        )
        const firstSegment = segments[0]
        const targetSegment = activeSegment || firstSegment

        if (targetSegment) {
          navigate(`/events/${event.id}/segments/${targetSegment.id}/participant`)
        } else {
          // No segments yet - still navigate to event detail for now
          // This could show a "waiting for host" message
          navigate(`/events/${event.id}`)
        }
      }
    } catch (err) {
      console.error('Failed to join event:', err)
      setError('Could not find an event with that join code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-dark-900 rounded-xl p-8 border border-dark-700 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Join an Event</h1>
        <p className="text-sm text-gray-400 mb-6 text-center">
          Enter the 6-character join code shown on the presenter&apos;s screen.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Join Code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={6}
            required
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={loading || !code.trim()}
          >
            {loading ? 'Joining...' : 'Join Event'}
          </Button>
        </form>
      </div>
    </div>
  )
}


