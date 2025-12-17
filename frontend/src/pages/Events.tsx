import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Edit2, Copy } from 'lucide-react'
import { Button } from '../components/common/Button'
import { Input } from '../components/common/Input'
import { listEvents, createEvent, deleteEvent } from '../api/endpoints'
import type { Event, CreateEventRequest } from '../api/endpoints'

export function EventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
  })
  const [creating, setCreating] = useState(false)

  // Load events
  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      setLoading(true)
      const response = await listEvents()
      setEvents(response.data)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.title.trim()) return

    try {
      setCreating(true)
      const newEvent = await createEvent({
        title: createForm.title,
        description: createForm.description || undefined,
        mode: 'listen_only',
        num_fake_answers: 3,
        time_per_question: 30,
      } as CreateEventRequest)
      setEvents([newEvent.data, ...events])
      setCreateForm({ title: '', description: '' })
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create event:', error)
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      await deleteEvent(id)
      setEvents(events.filter((e) => e.id !== id))
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code)
    alert('Join code copied to clipboard!')
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-blue-500'
      case 'active':
        return 'bg-green-500'
      case 'finished':
        return 'bg-gray-500'
      default:
        return 'bg-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Events</h1>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus size={20} />
            New Event
          </Button>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-dark-900 rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Event</h2>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <Input
                  label="Event Title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g., Marketing Conference 2025"
                />
                <Input
                  label="Description (optional)"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Add a description"
                />
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={!createForm.title.trim() || creating}>
                    {creating ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Events Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading events...</div>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-dark-900 rounded-lg p-12 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">No events yet</h3>
            <p className="text-gray-400 mb-6">Create your first event to get started</p>
            <Button onClick={() => setShowCreateModal(true)} variant="primary">
              Create Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-dark-900 rounded-lg p-6 hover:bg-dark-800 transition cursor-pointer border border-dark-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3
                    className="text-xl font-bold text-white flex-1"
                    onClick={() => navigate(`/events/${event.id}`)}
                  >
                    {event.title}
                  </h3>
                  <span className={`px-3 py-1 rounded text-white text-sm font-medium ${getStatusBadgeColor(event.status)}`}>
                    {event.status}
                  </span>
                </div>

                {event.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">{event.description}</p>
                )}

                <div className="bg-dark-800 rounded p-3 mb-4">
                  <div className="text-xs text-gray-500 mb-1">Join Code</div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-mono font-bold text-cyan-400">{event.join_code}</span>
                    <button
                      onClick={() => copyJoinCode(event.join_code)}
                      className="text-gray-400 hover:text-white transition"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-4">
                  Created {new Date(event.created_at).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => navigate(`/events/${event.id}`)}
                    variant="primary"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} />
                    Manage
                  </Button>
                  <Button
                    onClick={() => handleDeleteEvent(event.id)}
                    variant="secondary"
                    size="sm"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
