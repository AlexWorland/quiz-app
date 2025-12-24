import { useState } from 'react'
import { Button } from '@/components/common/Button'
import { StatusToast } from '@/components/common/StatusToast'

interface Participant {
  id: string
  username: string
  avatar_url?: string
  online?: boolean
}

interface PassPresenterButtonProps {
  participants: Participant[]
  currentUserId: string
  onPass: (nextPresenterId: string) => void
}

export function PassPresenterButton({
  participants,
  currentUserId,
  onPass
}: PassPresenterButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToast, setShowToast] = useState<{
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  } | null>(null)

  const eligibleParticipants = participants.filter(p => p.id !== currentUserId)

  return (
    <>
      <div className="relative">
        <Button onClick={() => { setIsOpen(!isOpen); setError(null); setShowToast(null) }}>
          Pass Presenter Role
        </Button>

      {isOpen && (
        <div className="absolute mt-2 bg-dark-900 border border-dark-700 shadow-lg rounded-lg p-2 z-10 min-w-[200px]">
          <p className="text-sm text-gray-400 mb-2">Select next presenter:</p>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          {eligibleParticipants.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No other participants available</p>
          ) : (
            eligibleParticipants.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  if (p.online === false) {
                    setError(null)
                    setShowToast({
                      message: `Cannot pass presenter to ${p.username}. They are currently disconnected. Please select an online participant.`,
                      type: 'warning'
                    })
                    return
                  }
                  onPass(p.id)
                  setIsOpen(false)
                  setShowToast({
                    message: `Presenter role passed to ${p.username}`,
                    type: 'success'
                  })
                }}
                className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded transition ${
                  p.online === false 
                    ? 'bg-dark-800/40 text-gray-500 cursor-not-allowed' 
                    : 'text-white hover:bg-dark-800'
                }`}
                disabled={p.online === false}
              >
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-2 h-2 rounded-full ${
                    p.online === false ? 'bg-red-400' : 'bg-green-400'
                  }`} />
                  <span>{p.username}</span>
                </div>
                {p.online === false && (
                  <span className="text-xs text-gray-500">(offline)</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
      </div>

      {/* Status Toast for feedback */}
      {showToast && (
        <StatusToast
          message={showToast.message}
          type={showToast.type}
          onClose={() => setShowToast(null)}
        />
      )}
    </>
  )
}

