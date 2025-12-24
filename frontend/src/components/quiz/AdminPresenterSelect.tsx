import { useState } from 'react'
import { UserCog, ChevronDown, User } from 'lucide-react'

interface Participant {
  id: string
  username: string
  avatar_url?: string
  is_connected?: boolean
}

interface AdminPresenterSelectProps {
  participants: Participant[]
  segmentId: string
  onSelect: (presenterId: string, segmentId: string) => void
  disabled?: boolean
}

/**
 * Admin-only component that allows the event host to directly assign
 * any participant as the presenter for the current segment.
 *
 * Unlike PassPresenterButton (which lets the current presenter hand off),
 * this allows the host to override presenter selection at any time.
 */
export function AdminPresenterSelect({
  participants,
  segmentId,
  onSelect,
  disabled = false
}: AdminPresenterSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParticipantSelect = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId)

    if (participant && participant.is_connected === false) {
      setError(`${participant.username} is disconnected and cannot be selected as presenter`)
      setTimeout(() => setError(null), 3000)
      return
    }

    onSelect(participantId, segmentId)
    setIsOpen(false)
    setError(null)
  }

  if (disabled) {
    return null
  }

  return (
    <div className="relative">
      {error && (
        <div className="absolute bottom-full mb-2 right-0 bg-red-500/90 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 rounded-lg text-sm text-amber-300 hover:text-amber-200 transition"
        title="Override presenter selection (host only)"
      >
        <UserCog className="w-4 h-4" />
        Assign Presenter
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute mt-2 bg-dark-900 border border-dark-700 shadow-xl rounded-lg p-3 z-20 min-w-[220px] right-0">
          <p className="text-sm text-gray-400 mb-2 font-medium">Select new presenter:</p>

          {participants.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No participants have joined yet</p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {participants.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleParticipantSelect(p.id)}
                  className="flex items-center gap-3 w-full px-3 py-2 hover:bg-dark-800 rounded text-white transition"
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.username}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-dark-700 flex items-center justify-center">
                      <User className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                  <span>{p.username}</span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setIsOpen(false)}
            className="mt-3 w-full text-xs text-gray-500 hover:text-gray-400 py-1"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
