import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2, ArrowLeft, UserPlus, Users, Play } from 'lucide-react'
import { Button } from '../components/common/Button'
import { JoinLockToggle } from '../components/event'
import { ExtendedLockReminder } from '../components/event/ExtendedLockReminder'
import { QRCodeDisplay } from '../components/event/QRCodeDisplay'
import { Input } from '../components/common/Input'
import { useAuthStore } from '../store/authStore'
import { getEvent, getEventSegments, createSegment, deleteSegment, joinAsHost } from '../api/endpoints'
import type { Event, Segment, CreateSegmentRequest } from '../api/endpoints'
import { useEventWebSocket, type ServerMessage, type Participant } from '../hooks/useEventWebSocket'

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setDeviceInfo = useAuthStore((state) => state.setDeviceInfo)

  const [event, setEvent] = useState<Event | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddSegment, setShowAddSegment] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinDisplayName, setJoinDisplayName] = useState('')
  const [formData, setFormData] = useState({
    presenter_name: '',
    title: '',
  })
  const [showExtendedLockReminder, setShowExtendedLockReminder] = useState(true)
  const [showPresenterSelect, setShowPresenterSelect] = useState(false)
  const [selectedPresenterId, setSelectedPresenterId] = useState<string | null>(null)

  // WebSocket connection for real-time participant tracking and presenter selection
  const { 
    isConnected, 
    participants, 
    pendingPresenter,
    currentSegmentId,
    sendMessage 
  } = useEventWebSocket({
    eventId: eventId ?? '',
    onMessage: (msg: ServerMessage) => {
      if (msg.type === 'error') {
        alert(msg.message)
      } else if (msg.type === 'presentation_started') {
        // Redirect to host view when presentation starts
        navigate(`/events/${eventId}/segments/${msg.segment_id}/host`)
      } else if (msg.type === 'presenter_selected') {
        // If someone else was selected and it's the current user, they should be notified
        // The pendingPresenter state is already updated in the hook
      }
    },
  })

  useEffect(() => {
    loadEvent()
  }, [eventId])

  const loadEvent = async () => {
    if (!eventId) return
    try {
      setLoading(true)
      const [eventRes, segmentsRes] = await Promise.all([
        getEvent(eventId),
        getEventSegments(eventId)
      ])
      setEvent(eventRes.data)
      setSegments(segmentsRes.data)
    } catch (error) {
      console.error('Failed to load event:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinEvent = async () => {
    if (!eventId || !joinDisplayName.trim()) return

    try {
      const response = await joinAsHost(eventId, {
        display_name: joinDisplayName.trim(),
        avatar_url: user?.avatar_url,
        avatar_type: user?.avatar_type,
      })

      // Store participant session info
      setDeviceInfo(response.data.deviceId, response.data.sessionToken)
      
      // Store event session tracking
      const sessionData = {
        eventId: response.data.eventId,
        eventTitle: event?.title || 'Event',
        joinedAt: new Date(),
      }
      localStorage.setItem('current_event_session', JSON.stringify(sessionData))

      // Navigate to participant view (first segment or event page)
      if (segments.length > 0) {
        navigate(`/events/${eventId}/segments/${segments[0].id}`)
      } else {
        navigate(`/events/${eventId}`)
      }
    } catch (error) {
      console.error('Failed to join event:', error)
      alert('Failed to join event. Please try again.')
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

  const handleSelectPresenter = (participantId: string) => {
    if (!isConnected) {
      alert('Not connected to event. Please wait for connection.')
      return
    }
    sendMessage({ type: 'select_presenter', presenter_user_id: participantId })
    setShowPresenterSelect(false)
    setSelectedPresenterId(null)
  }

  // Get online participants for presenter selection (excluding host)
  const onlineParticipants = participants.filter(p => p.online !== false)

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
          <div className="flex flex-col items-center justify-center gap-4">
            <QRCodeDisplay
              joinCode={event.join_code}
              isLocked={event.join_locked}
              size={120}
            />
            <Button
              variant="primary"
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-2"
              disabled={event.join_locked}
            >
              <UserPlus size={16} />
              Join Event
            </Button>
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

        {/* Connected Participants & Presenter Selection */}
        <div className="bg-dark-900 rounded-lg p-6 mb-8 border border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="text-cyan-400" size={20} />
              <h3 className="text-lg font-semibold text-white">Connected Participants</h3>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <span className="text-sm text-gray-400">{onlineParticipants.length} online</span>
          </div>

          {onlineParticipants.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 mb-2">No participants connected yet</p>
              <p className="text-sm text-gray-500">Share the join code or QR code to let participants join</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {onlineParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 p-2 bg-dark-800 rounded-lg"
                >
                  {p.avatar_url ? (
                    <span className="text-xl">{p.avatar_url}</span>
                  ) : (
                    <div className="w-8 h-8 bg-cyan-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {p.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white truncate">{p.username}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pending Presenter Info */}
          {pendingPresenter && (
            <div className="bg-cyan-900/30 border border-cyan-500/50 rounded-lg p-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-cyan-300 font-medium">Presenter Selected</p>
                  <p className="text-white">{pendingPresenter.name} is ready to present</p>
                  {user && pendingPresenter.id === user.id ? (
                    <p className="text-sm text-cyan-200 mt-1">
                      You are the selected presenter. Click below to start your presentation.
                    </p>
                  ) : (
                    <p className="text-sm text-cyan-200 mt-1">
                      Waiting for them to start their presentation...
                    </p>
                  )}
                </div>
                {user && pendingPresenter.id === user.id && (
                  <Button
                    onClick={() => sendMessage({ type: 'start_presentation' })}
                    variant="primary"
                    className="flex items-center gap-2"
                  >
                    <Play size={18} />
                    Start Presentation
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Select First Presenter Button - only show if no segments and no pending presenter */}
          {segments.length === 0 && !pendingPresenter && onlineParticipants.length > 0 && (
            <div className="mt-4">
              <Button
                onClick={() => setShowPresenterSelect(true)}
                variant="primary"
                className="w-full flex items-center justify-center gap-2"
              >
                <Play size={18} />
                Select First Presenter
              </Button>
              <p className="text-sm text-gray-400 text-center mt-2">
                Select a participant to be the first presenter. They will see options to start their presentation.
              </p>
            </div>
          )}
        </div>

        {/* Segments Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Presentation Segments</h2>
          <Button
            onClick={() => setShowAddSegment(true)}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            Add Segment Manually
          </Button>
        </div>

        {/* Presenter Selection Modal */}
        {showPresenterSelect && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-900 rounded-lg p-8 max-w-md w-full border border-dark-700">
              <h3 className="text-2xl font-bold text-white mb-4">Select First Presenter</h3>
              <p className="text-gray-400 text-sm mb-6">
                Choose a participant to be the first presenter. They will be able to start recording and presenting.
              </p>
              
              {onlineParticipants.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No participants online</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {onlineParticipants.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPresenterId(p.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                        selectedPresenterId === p.id
                          ? 'bg-cyan-900/50 border border-cyan-500'
                          : 'bg-dark-800 hover:bg-dark-700 border border-transparent'
                      }`}
                    >
                      {p.avatar_url ? (
                        <span className="text-2xl">{p.avatar_url}</span>
                      ) : (
                        <div className="w-10 h-10 bg-cyan-600 rounded-full flex items-center justify-center text-white font-medium">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-white font-medium">{p.username}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPresenterSelect(false)
                    setSelectedPresenterId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!selectedPresenterId}
                  onClick={() => selectedPresenterId && handleSelectPresenter(selectedPresenterId)}
                  className="flex items-center gap-2"
                >
                  <Play size={16} />
                  Select as Presenter
                </Button>
              </div>
            </div>
          </div>
        )}

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
            <p className="text-gray-400 mb-4">
              Segments are created automatically when presenters start their presentations.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Select a presenter from the connected participants above to get started, or add segments manually.
            </p>
            <Button onClick={() => setShowAddSegment(true)} variant="secondary">
              Add Segment Manually
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

      {/* Join Event Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-8 max-w-md w-full border border-dark-700">
            <h3 className="text-2xl font-bold text-white mb-4">Join Your Event</h3>
            <p className="text-gray-400 text-sm mb-6">
              Enter a display name to join as a participant. You'll be able to play the quiz and compete with your guests!
            </p>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleJoinEvent()
            }} className="space-y-4">
              <Input
                label="Display Name"
                value={joinDisplayName}
                onChange={(e) => setJoinDisplayName(e.target.value)}
                placeholder="e.g., Quiz Master"
                required
                autoFocus
              />
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowJoinModal(false)
                    setJoinDisplayName('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!joinDisplayName.trim()}
                  className="flex items-center gap-2"
                >
                  <UserPlus size={16} />
                  Join Event
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
