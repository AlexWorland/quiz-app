import { useState, useEffect } from 'react'
import { Lock, Unlock, X, Clock } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface ExtendedLockReminderProps {
  eventId: string
  lockedAt: Date
  onUnlock: () => Promise<void>
  onDismiss: () => void
  className?: string
}

export function ExtendedLockReminder({
  eventId,
  lockedAt,
  onUnlock,
  onDismiss,
  className = ''
}: ExtendedLockReminderProps) {
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [lockDurationMinutes, setLockDurationMinutes] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const updateDuration = () => {
      const minutes = Math.floor((Date.now() - lockedAt.getTime()) / 60000)
      setLockDurationMinutes(minutes)
    }

    updateDuration()
    const interval = setInterval(updateDuration, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [lockedAt])

  // Auto-reappear every 5 minutes if dismissed
  useEffect(() => {
    if (dismissed && lockDurationMinutes > 0 && lockDurationMinutes % 5 === 0) {
      setDismissed(false)
    }
  }, [dismissed, lockDurationMinutes])

  const handleUnlock = async () => {
    setIsUnlocking(true)
    try {
      await onUnlock()
    } catch (error) {
      console.error('Failed to unlock:', error)
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss()
  }

  // Don't show if dismissed or less than 5 minutes
  if (dismissed || lockDurationMinutes < 5) {
    return null
  }

  const getReminderConfig = () => {
    if (lockDurationMinutes >= 15) {
      return {
        icon: '🚨',
        title: 'Critical: Joining Locked Too Long',
        message: `Joining has been locked for ${lockDurationMinutes} minutes! Late participants are being turned away.`,
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-300',
        urgency: 'critical'
      }
    } else if (lockDurationMinutes >= 10) {
      return {
        icon: '⚠️',
        title: 'High Priority: Extended Lock',
        message: `Joining has been locked for ${lockDurationMinutes} minutes. Consider unlocking for late participants.`,
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-300',
        urgency: 'high'
      }
    } else {
      return {
        icon: '💡',
        title: 'Reminder: Joining Locked',
        message: `Joining has been locked for ${lockDurationMinutes} minutes. Don't forget to unlock for late participants.`,
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-300',
        urgency: 'medium'
      }
    }
  }

  const config = getReminderConfig()

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md ${className}`}>
      <div className={`${config.bgColor} ${config.borderColor} border-2 rounded-lg p-4 shadow-lg animate-pulse`}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">{config.icon}</div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Lock className={`w-4 h-4 ${config.textColor}`} />
              <h3 className={`font-semibold text-sm ${config.textColor}`}>
                {config.title}
              </h3>
            </div>
            
            <p className={`text-xs mb-3 ${config.textColor.replace('-300', '-200')}`}>
              {config.message}
            </p>

            <div className="flex items-center gap-1 mb-3">
              <Clock className={`w-3 h-3 ${config.textColor}`} />
              <span className={`text-xs ${config.textColor}`}>
                Locked at {lockedAt.toLocaleTimeString()}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleUnlock}
                disabled={isUnlocking}
                variant="primary"
                className="flex-1 text-xs py-1"
              >
                <Unlock className="w-3 h-3 mr-1" />
                {isUnlocking ? 'Unlocking...' : 'Unlock Now'}
              </Button>

              <Button
                onClick={handleDismiss}
                variant="secondary"
                className="px-2 py-1"
                title="Dismiss for 5 minutes"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
