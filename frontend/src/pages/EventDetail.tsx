import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2, ArrowLeft } from 'lucide-react'
import { Button } from '../components/common/Button'
import { JoinLockToggle } from '../components/event'
import { ExtendedLockReminder } from '../components/event/ExtendedLockReminder'
import { QRCodeDisplay } from '../components/event/QRCodeDisplay'
import { Input } from '../components/common/Input'
import { getEvent, createSegment, deleteSegment } from '../api/endpoints'
import type { Event, Segment, CreateSegmentRequest } from '../api/endpoints'

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSegment, setShowAddSegment] = useState(false)
  const [formData, setFormData] = useState({
    presenter_name: '',
    title: '',
  })
  const [showExtendedLockReminder, setShowExtendedLockReminder] = useState(true)

  useEffect(() => {
    loadEvent()
  }, [eventId])

  const loadEvent = async () => {
    if (!eventId) return
    try {
      setLoading(true)
      const response = await getEvent(eventId)
      setEvent(response.data)
      // In a real app, we'd fetch segments as well
      // For now, we'll use a mock or assume segments are returned with event
      setSegments([])
    } catch (error) {
      console.error('Failed to load event:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSegment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventId || !formData.presenter_name.trim()) return

    try {
      const newSegment = await createSegment(eventId, {
        presenter_name: formData.presenter_name,
        title: formData.title || undefined,
      } as CreateSegmentRequest)
      setSegments([...segments, newSegment.data])
      setFormData({ presenter_name: '', title: '' })
      setShowAddSegment(false)
    } catch (error) {
      console.error('Failed to add segment:', error)
    }
  }

  const handleDeleteSegment = async (segmentId: string) => {
    if (!eventId || !confirm('Delete this segment?')) return

    try {
      await deleteSegment(eventId, segmentId)
      setSegments(segments.filter((s) => s.id !== segmentId))
    } catch (error) {
      console.error('Failed to delete segment:', error)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-600',
      recording: 'bg-red-600',
      recording_paused: 'bg-yellow-600',
      quiz_ready: 'bg-blue-600',
      quizzing: 'bg-green-600',
      completed: 'bg-gray-500',
    }
    return colors[status] || 'bg-gray-600'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-gray-400">Loading event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-red-400">Event not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/events')}
            className="text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white">{event.title}</h1>
            {event.description && (
              <p className="text-gray-400 mt-2">{event.description}</p>
            )}
          </div>
        </div>

        {/* Event Info + Join QR */}
        <div className="bg-dark-900 rounded-lg p-6 mb-8 border border-dark-700 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-6 items-center">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Join Code</div>
              <div className="text-2xl font-mono font-bold text-cyan-400">{event.join_code}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Mode</div>
              <div className="text-lg text-white capitalize">{event.mode.replace('_', ' ')}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Status</div>
              <div className="text-lg text-white capitalize">{event.status}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Segments</div>
              <div className="text-lg text-white">{segments.length}</div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center">
            <QRCodeDisplay
              joinCode={event.join_code}
              isLocked={event.join_locked}
              size={120}
            />
          </div>
        </div>

        {/* Join Lock Controls */}
        <div className="bg-dark-900 rounded-lg p-4 mb-8 border border-dark-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-white">Participant Joining</h3>
              <p className="text-xs text-gray-400 mt-1">
                {event.join_locked
                  ? 'New participants cannot join. Existing participants can still rejoin.'
                  : 'New participants can join via QR code or event code.'}
              </p>
            </div>
            <JoinLockToggle
              eventId={event.id}
              initialLocked={event.join_locked}
              onLockChange={(locked) => setEvent(prev => prev ? { ...prev, join_locked: locked } : prev)}
            />
          </div>
        </div>

        {/* Segments Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Presentation Segments</h2>
          <Button
            onClick={() => setShowAddSegment(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Add Segment
          </Button>
        </div>

        {/* Add Segment Modal */}
        {showAddSegment && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-900 rounded-lg p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold text-white mb-6">Add Presentation Segment</h3>
              <form onSubmit={handleAddSegment} className="space-y-4">
                <Input
                  label="Presenter Name"
                  value={formData.presenter_name}
                  onChange={(e) => setFormData({ ...formData, presenter_name: e.target.value })}
                  placeholder="e.g., John Smith"
                  required
                />
                <Input
                  label="Segment Title (optional)"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Q1 Results"
                />
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowAddSegment(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!formData.presenter_name.trim()}
                  >
                    Add Segment
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Segments List */}
        {segments.length === 0 ? (
          <div className="bg-dark-900 rounded-lg p-12 text-center border border-dark-700">
            <h3 className="text-xl font-semibold text-white mb-2">No segments yet</h3>
            <p className="text-gray-400 mb-6">Add presentation segments to get started</p>
            <Button onClick={() => setShowAddSegment(true)} variant="primary">
              Add First Segment
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                className="bg-dark-900 rounded-lg p-6 border border-dark-700 hover:border-dark-600 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 cursor-pointer" onClick={() => navigate(`/events/${eventId}/segments/${segment.id}/host`)}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-semibold text-gray-400">Segment {index + 1}</span>
                      <span className={`px-2 py-1 rounded text-white text-xs font-medium ${getStatusColor(segment.status)}`}>
                        {segment.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {segment.title || segment.presenter_name}
                    </h3>
                    <p className="text-gray-400 text-sm">Presenter: {segment.presenter_name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/events/${eventId}/segments/${segment.id}/host`)}
                      className="p-2 text-gray-400 hover:text-white bg-dark-800 rounded transition"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteSegment(segment.id)}
                      className="p-2 text-gray-400 hover:text-red-400 bg-dark-800 rounded transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extended Lock Reminder - Fixed Position Overlay */}
      {event?.join_locked && event.join_locked_at && showExtendedLockReminder && (
        <ExtendedLockReminder
          eventId={event.id}
          lockedAt={new Date(event.join_locked_at)}
          onUnlock={async () => {
            // Use the same unlock logic as JoinLockToggle
            const { unlockEventJoin } = await import('../api/endpoints')
            await unlockEventJoin(event.id)
            setEvent(prev => prev ? { ...prev, join_locked: false, join_locked_at: null } : prev)
          }}
          onDismiss={() => setShowExtendedLockReminder(false)}
        />
      )}
    </div>
  )
}
