import { useState, useEffect } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/common/Button'
import { lockEventJoin, unlockEventJoin, getJoinLockStatus } from '@/api/endpoints'

interface JoinLockToggleProps {
  eventId: string
  initialLocked?: boolean
  onLockChange?: (locked: boolean) => void
}

export function JoinLockToggle({
  eventId,
  initialLocked = false,
  onLockChange,
}: JoinLockToggleProps) {
  const [isLocked, setIsLocked] = useState(initialLocked)
  const [loading, setLoading] = useState(false)
  const [lockedAt, setLockedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLocked(initialLocked)
  }, [initialLocked])

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await getJoinLockStatus(eventId)
        setIsLocked(response.data.join_locked)
        setLockedAt(response.data.join_locked_at ? new Date(response.data.join_locked_at) : null)
      } catch {
        // Ignore fetch errors - will use initial state
      }
    }
    fetchStatus()
  }, [eventId])

  const handleToggle = async () => {
    setLoading(true)
    setError(null)

    try {
      if (isLocked) {
        const response = await unlockEventJoin(eventId)
        setIsLocked(response.data.join_locked)
        setLockedAt(null)
        onLockChange?.(false)
      } else {
        const response = await lockEventJoin(eventId)
        setIsLocked(response.data.join_locked)
        setLockedAt(response.data.join_locked_at ? new Date(response.data.join_locked_at) : null)
        onLockChange?.(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lock status')
    } finally {
      setLoading(false)
    }
  }

  // Calculate how long it's been locked
  const getLockDuration = () => {
    if (!lockedAt) return null
    const minutes = Math.floor((Date.now() - lockedAt.getTime()) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes === 1) return '1 minute'
    return `${minutes} minutes`
  }

  const getLockDurationMinutes = () => {
    if (!lockedAt) return 0
    return Math.floor((Date.now() - lockedAt.getTime()) / 60000)
  }

  const lockDuration = getLockDuration()
  const lockMinutes = getLockDurationMinutes()

  // Determine reminder level based on duration
  const getReminderLevel = () => {
    if (lockMinutes >= 15) return 'critical'
    if (lockMinutes >= 10) return 'high' 
    if (lockMinutes >= 5) return 'medium'
    return 'none'
  }

  const reminderLevel = getReminderLevel()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant={isLocked ? 'secondary' : 'primary'}
          onClick={handleToggle}
          disabled={loading}
          className="flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isLocked ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Unlock className="w-4 h-4" />
          )}
          {isLocked ? 'Unlock Joining' : 'Lock Joining'}
        </Button>

        {isLocked && (
          <span className="text-sm text-amber-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Joining locked
            {lockDuration && ` (${lockDuration})`}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {isLocked && reminderLevel !== 'none' && (
        <div className={`text-xs p-2 rounded border ${
          reminderLevel === 'critical' ? 'bg-red-500/20 border-red-500/50 text-red-300' :
          reminderLevel === 'high' ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' :
          'bg-amber-500/20 border-amber-500/50 text-amber-300'
        }`}>
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 flex-shrink-0" />
            <span>
              {reminderLevel === 'critical' 
                ? `🚨 Joining locked for ${lockMinutes} minutes! Late participants are being blocked.`
                : reminderLevel === 'high'
                ? `⚠️ Joining locked for ${lockMinutes} minutes. Consider unlocking for late participants.`
                : `💡 Joining locked for ${lockMinutes} minutes. New participants cannot join until unlocked.`
              }
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
