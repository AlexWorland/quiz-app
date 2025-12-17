import { useState, useEffect } from 'react'
import { Radio as RadioIcon } from 'lucide-react'

interface RecordingStatusProps {
  status: 'pending' | 'recording' | 'recording_paused' | 'quiz_ready' | 'quizzing' | 'completed'
  startedAt?: string
}

export function RecordingStatus({ status, startedAt }: RecordingStatusProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (status !== 'recording' || !startedAt) {
      setElapsed(0)
      return
    }

    const startTime = new Date(startedAt).getTime()
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsed(Math.floor((now - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [status, startedAt])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusText = () => {
    switch (status) {
      case 'recording':
        return 'LIVE'
      case 'recording_paused':
        return 'PAUSED'
      case 'quiz_ready':
        return 'READY FOR QUIZ'
      case 'quizzing':
        return 'QUIZ IN PROGRESS'
      case 'completed':
        return 'COMPLETED'
      default:
        return 'NOT STARTED'
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'recording':
        return 'text-red-500'
      case 'recording_paused':
        return 'text-yellow-500'
      case 'quiz_ready':
        return 'text-green-500'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status === 'recording' && (
        <RadioIcon className="w-5 h-5 text-red-500 animate-pulse" />
      )}
      <div>
        <div className={`font-semibold ${getStatusColor()}`}>{getStatusText()}</div>
        {status === 'recording' && (
          <div className="text-sm text-gray-400">{formatTime(elapsed)}</div>
        )}
      </div>
    </div>
  )
}

