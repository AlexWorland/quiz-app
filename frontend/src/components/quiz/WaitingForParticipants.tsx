import { useEffect, useState } from 'react'
import { Users, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface WaitingForParticipantsProps {
  eventTitle: string
  eventCode: string
  segmentTitle?: string
  presenterName: string
  participantCount: number
  onRefresh?: () => void
  onResume?: () => void
  isHost?: boolean
}

export function WaitingForParticipants({
  eventTitle,
  eventCode,
  segmentTitle,
  presenterName,
  participantCount,
  onRefresh,
  onResume,
  isHost = false
}: WaitingForParticipantsProps) {
  const [countdown, setCountdown] = useState(30)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)

  // Auto-refresh countdown
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onRefresh?.()
          return 30 // Reset countdown
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [autoRefreshEnabled, onRefresh])

  const handleManualRefresh = () => {
    setCountdown(30)
    onRefresh?.()
  }

  return (
    <div className="bg-gradient-to-br from-blue-900/30 via-purple-900/30 to-indigo-900/30 rounded-lg border border-blue-500/30 p-6 text-center">
      {/* Icon and Status */}
      <div className="mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <Users className="w-16 h-16 text-blue-300 opacity-50" />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
              <WifiOff className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">
          Waiting for Participants
        </h2>
        
        <p className="text-blue-200 text-lg mb-2">
          All participants have disconnected from the quiz
        </p>
        
        <p className="text-blue-300/80 text-sm">
          {participantCount === 0 
            ? 'No participants are currently connected'
            : `${participantCount} participant${participantCount !== 1 ? 's' : ''} connected`
          }
        </p>
      </div>

      {/* Event Information */}
      <div className="bg-white/5 rounded-lg p-4 mb-6">
        <div className="text-left space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-blue-300 text-sm">Event:</span>
            <span className="text-white font-medium">{eventTitle}</span>
          </div>
          {segmentTitle && (
            <div className="flex justify-between items-center">
              <span className="text-blue-300 text-sm">Segment:</span>
              <span className="text-white font-medium">{segmentTitle}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-blue-300 text-sm">Presenter:</span>
            <span className="text-white font-medium">{presenterName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-300 text-sm">Join Code:</span>
            <span className="text-white font-mono font-bold text-lg">{eventCode}</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
        <h3 className="text-blue-200 font-semibold mb-2">How to Continue</h3>
        <ul className="text-blue-300/90 text-sm space-y-1 text-left">
          <li>• Share the join code <strong>{eventCode}</strong> with participants</li>
          <li>• Ask participants to rejoin via QR code or manual entry</li>
          <li>• Quiz will automatically resume when participants reconnect</li>
          {isHost && <li>• Or manually resume if you want to continue anyway</li>}
        </ul>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center">
        <Button
          onClick={handleManualRefresh}
          variant="primary"
          className="flex items-center gap-2"
          disabled={!onRefresh}
        >
          <RefreshCw className="w-4 h-4" />
          Check Now
        </Button>

        <Button
          onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Wifi className="w-4 h-4" />
          Auto-refresh: {autoRefreshEnabled ? 'On' : 'Off'}
        </Button>

        {isHost && onResume && (
          <Button
            onClick={onResume}
            variant="secondary"
            className="flex items-center gap-2"
          >
            Continue Anyway
          </Button>
        )}
      </div>

      {/* Auto-refresh countdown */}
      {autoRefreshEnabled && onRefresh && (
        <p className="text-blue-400/60 text-xs mt-4">
          Auto-refreshing in {countdown} seconds...
        </p>
      )}

      {/* Connection Status Animation */}
      <div className="flex justify-center items-center gap-1 mt-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
            style={{
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1.5s'
            }}
          />
        ))}
      </div>
    </div>
  )
}
