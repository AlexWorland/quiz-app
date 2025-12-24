import { useState } from 'react'
import { RotateCcw, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface ResumeControlsProps {
  type: 'segment' | 'event'
  previousStatus?: string | null
  onResume: () => Promise<void>
  onClearResume: () => Promise<void>
  disabled?: boolean
  warningMessage?: string | null
}

export function ResumeControls({
  type,
  previousStatus,
  onResume,
  onClearResume,
  disabled = false,
  warningMessage = null
}: ResumeControlsProps) {
  const [isResuming, setIsResuming] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<number>(0)

  if (!previousStatus) {
    return null
  }

  const handleResume = async () => {
    // Prevent rapid clicking (debounce with 2 second cooldown)
    const now = Date.now()
    if (now - lastAction < 2000) {
      const remaining = Math.ceil((2000 - (now - lastAction)) / 1000)
      setError(`Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before trying again`)
      return
    }
    setLastAction(now)

    setIsResuming(true)
    setError(null)
    try {
      await onResume()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume')
    } finally {
      setIsResuming(false)
    }
  }

  const handleClearResume = async () => {
    // Prevent rapid clicking (debounce with 2 second cooldown)
    const now = Date.now()
    if (now - lastAction < 2000) {
      const remaining = Math.ceil((2000 - (now - lastAction)) / 1000)
      setError(`Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before trying again`)
      return
    }
    setLastAction(now)

    setIsClearing(true)
    setError(null)
    try {
      await onClearResume()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear resume state')
    } finally {
      setIsClearing(false)
    }
  }

  const typeName = type === 'segment' ? 'segment' : 'event'

  return (
    <div className="bg-amber-900/20 border-2 border-amber-600 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-amber-300 font-semibold text-sm mb-1">
            {typeName.charAt(0).toUpperCase() + typeName.slice(1)} Ended Accidentally?
          </h3>
          <p className="text-amber-200/80 text-xs">
            This {typeName} was recently ended. You can resume it if this was a mistake,
            or clear this message to confirm the ending.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-2">
          <p className="text-red-300 text-xs">{error}</p>
        </div>
      )}

      {warningMessage && (
        <div className="bg-orange-500/20 border border-orange-500/50 rounded p-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-300 mt-0.5 flex-shrink-0" />
            <p className="text-orange-200 text-xs">{warningMessage}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleResume}
          disabled={disabled || isResuming || isClearing}
          variant="primary"
          className="flex-1 text-sm"
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          {isResuming ? 'Resuming...' : 'Resume'}
        </Button>

        <Button
          onClick={handleClearResume}
          disabled={disabled || isResuming || isClearing}
          variant="secondary"
          className="flex-1 text-sm"
        >
          <X className="w-4 h-4 mr-1" />
          {isClearing ? 'Clearing...' : 'Clear & Continue'}
        </Button>
      </div>
    </div>
  )
}
