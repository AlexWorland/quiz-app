import { useState } from 'react'
import { Button } from '@/components/common/Button'

interface Participant {
  id: string
  username: string
  avatar_url?: string
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

  const eligibleParticipants = participants.filter(p => p.id !== currentUserId)

  return (
    <div className="relative">
      <Button onClick={() => setIsOpen(!isOpen)}>
        Pass Presenter Role
      </Button>

      {isOpen && (
        <div className="absolute mt-2 bg-dark-900 border border-dark-700 shadow-lg rounded-lg p-2 z-10 min-w-[200px]">
          <p className="text-sm text-gray-400 mb-2">Select next presenter:</p>
          {eligibleParticipants.length === 0 ? (
            <p className="text-sm text-gray-500 py-2">No other participants available</p>
          ) : (
            eligibleParticipants.map(p => (
              <button
                key={p.id}
                onClick={() => { onPass(p.id); setIsOpen(false); }}
                className="block w-full text-left px-3 py-2 hover:bg-dark-800 rounded text-white transition"
              >
                {p.username}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

