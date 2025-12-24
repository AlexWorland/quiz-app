import { useState } from 'react'
import { AlertCircle, Clock, Unlock } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface JoinLockReminderProps {
  lockDuration: number
  onUnlock: () => Promise<void>
  onDismiss: () => void
  isLoading?: boolean
}

export function JoinLockReminder({
  lockDuration,
  onUnlock,
  onDismiss,
  isLoading = false,
}: JoinLockReminderProps) {
  const [showReminder, setShowReminder] = useState(true)

  const minutes = Math.floor(lockDuration / 60)
  const seconds = lockDuration % 60

  if (!showReminder) {
    return null
  }

  return (
    <div className="bg-yellow-900/20 border border-yellow-600/60 rounded-lg p-4 flex items-start gap-4">
      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-yellow-300 mb-1">Joining Locked Reminder</h3>
        <div className="flex items-center gap-2 text-sm text-yellow-200">
          <Clock className="w-4 h-4" />
          <span>Joining has been locked for {minutes}m {seconds}s</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setShowReminder(false)
            onDismiss()
          }}
          className="text-yellow-200 border-yellow-600/60 hover:bg-yellow-900/20"
        >
          Dismiss
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            try {
              await onUnlock()
              setShowReminder(false)
            } catch (error) {
              console.error('Failed to unlock:', error)
            }
          }}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <Unlock className="w-4 h-4" />
          {isLoading ? 'Unlocking...' : 'Unlock Now'}
        </Button>
      </div>
    </div>
  )
}
