import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface SessionRecoveryProps {
  eventId: string
  onRecoveryComplete: () => void
  onRecoveryFailed: () => void
}

export function SessionRecovery({
  eventId,
  onRecoveryComplete,
  onRecoveryFailed,
}: SessionRecoveryProps) {
  const [status, setStatus] = useState<'checking' | 'recovering' | 'failed'>('checking')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const attemptRecovery = async () => {
      setStatus('checking')
      setProgress(10)

      try {
        // Check for existing session in localStorage
        const sessionKey = `quiz_session_${eventId}`
        const existingSession = localStorage.getItem(sessionKey)

        if (!existingSession) {
          onRecoveryFailed()
          return
        }

        setProgress(30)
        setStatus('recovering')

        // Parse session data
        const sessionData = JSON.parse(existingSession)
        
        setProgress(60)
        
        // Wait a bit to show progress
        await new Promise((resolve) => setTimeout(resolve, 500))
        
        setProgress(90)
        
        // Session data exists, recovery can proceed
        await new Promise((resolve) => setTimeout(resolve, 300))
        
        setProgress(100)
        onRecoveryComplete()
      } catch (error) {
        console.error('Session recovery failed:', error)
        setStatus('failed')
        setTimeout(() => {
          onRecoveryFailed()
        }, 1000)
      }
    }

    attemptRecovery()
  }, [eventId, onRecoveryComplete, onRecoveryFailed])

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-slate-700">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-spin" />
          
          <h2 className="text-2xl font-bold text-white mb-2">
            {status === 'checking' && 'Checking for existing session...'}
            {status === 'recovering' && 'Restoring your session...'}
            {status === 'failed' && 'Recovery failed'}
          </h2>
          
          <p className="text-slate-400 mb-6">
            {status === 'checking' && 'Looking for your previous session data'}
            {status === 'recovering' && 'Reconnecting to the quiz and restoring your progress'}
            {status === 'failed' && 'Unable to restore your session. Starting fresh.'}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-xs text-slate-500 mt-3">
            {progress}% complete
          </p>
        </div>
      </div>
    </div>
  )
}

