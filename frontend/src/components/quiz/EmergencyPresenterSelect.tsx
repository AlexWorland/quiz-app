import { useState } from 'react'
import { AlertTriangle, Users, User, Wifi, WifiOff, X } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface Participant {
  id: string
  username: string
  avatar_url?: string
  online?: boolean
}

interface EmergencyPresenterSelectProps {
  participants: Participant[]
  segmentId: string
  disconnectedPresenterName: string
  eventCode: string
  onSelect: (presenterId: string, segmentId: string) => void
  onDismiss: () => void
  isVisible: boolean
}

export function EmergencyPresenterSelect({
  participants,
  segmentId,
  disconnectedPresenterName,
  eventCode,
  onSelect,
  onDismiss,
  isVisible
}: EmergencyPresenterSelectProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)

  const onlineParticipants = participants.filter(p => p.online !== false)
  const hasOnlineParticipants = onlineParticipants.length > 0

  const handleSelect = async () => {
    if (!selectedParticipant) return

    setIsSelecting(true)
    try {
      await onSelect(selectedParticipant, segmentId)
      onDismiss()
    } catch (error) {
      console.error('Failed to select emergency presenter:', error)
    } finally {
      setIsSelecting(false)
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-red-500/50 rounded-lg shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="bg-red-500/20 border-b border-red-500/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-red-300 font-bold text-lg mb-1">
                Emergency Presenter Selection
              </h2>
              <p className="text-red-200/90 text-sm">
                <span className="font-medium">{disconnectedPresenterName}</span> has disconnected
                during their presentation. Select a new presenter to continue.
              </p>
            </div>
            <button
              onClick={onDismiss}
              className="text-red-300 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Event Info */}
          <div className="bg-dark-800/50 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">Event Code:</span>
              <span className="text-white font-mono font-bold">{eventCode}</span>
            </div>
          </div>

          {/* Participant Selection */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-300" />
              <h3 className="text-blue-300 font-semibold">
                Select New Presenter ({onlineParticipants.length} online)
              </h3>
            </div>

            {!hasOnlineParticipants ? (
              <div className="text-center py-8">
                <WifiOff className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-400 mb-2">No participants are currently connected</p>
                <p className="text-gray-500 text-sm">
                  Share the event code {eventCode} to get participants back online
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {onlineParticipants.map(p => (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition ${
                      selectedParticipant === p.id
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-dark-700 hover:border-blue-400/50 hover:bg-dark-800/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="emergency-presenter"
                      value={p.id}
                      checked={selectedParticipant === p.id}
                      onChange={() => setSelectedParticipant(p.id)}
                      className="sr-only"
                    />
                    
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <Wifi className="w-4 h-4 text-green-400" />
                      </div>

                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500/30 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-300" />
                        </div>
                      )}

                      <div>
                        <div className="text-white font-medium">{p.username}</div>
                        <div className="text-green-300 text-xs">Online</div>
                      </div>
                    </div>

                    {selectedParticipant === p.id && (
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSelect}
              disabled={!selectedParticipant || isSelecting || !hasOnlineParticipants}
              variant="primary"
              className="flex-1"
            >
              {isSelecting ? 'Selecting...' : 'Select as Presenter'}
            </Button>

            <Button
              onClick={onDismiss}
              variant="secondary"
              className="px-6"
            >
              Cancel
            </Button>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs">
            <p className="text-yellow-200">
              <strong>Note:</strong> The selected participant will automatically become the presenter
              and gain control of the quiz. They will be redirected to the presenter view.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
