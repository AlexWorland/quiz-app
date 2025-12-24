import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ReconnectionStatusProps {
  isReconnecting: boolean
  attemptCount: number
  nextAttemptSeconds: number
  hasGivenUp: boolean
  onManualRetry?: () => void
}

export function ReconnectionStatus({
  isReconnecting,
  attemptCount,
  nextAttemptSeconds,
  hasGivenUp,
  onManualRetry,
}: ReconnectionStatusProps) {
  if (!isReconnecting && !hasGivenUp) {
    return null
  }

  if (hasGivenUp) {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
        <div className="bg-red-900/90 border border-red-500/50 rounded-lg p-4 shadow-2xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                Connection Lost
              </h3>
              <p className="text-sm text-red-200 mb-3">
                Unable to reconnect to the quiz. Your progress has been saved.
              </p>
              {onManualRetry && (
                <Button
                  onClick={onManualRetry}
                  variant="secondary"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
      <div className="bg-amber-900/90 border border-amber-500/50 rounded-lg p-4 shadow-2xl backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <WifiOff className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-1">
              Reconnecting...
            </h3>
            <p className="text-sm text-amber-200 mb-2">
              Connection lost. Attempting to reconnect.
            </p>
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>
                Attempt {attemptCount} • Next try in {nextAttemptSeconds}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

