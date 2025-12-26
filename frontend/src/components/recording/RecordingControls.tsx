import { Play, Pause, Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '../common/Button'

interface RecordingControlsProps {
  status: 'pending' | 'recording' | 'recording_paused' | 'quiz_ready' | 'quizzing' | 'completed'
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onRestart: () => void
  disabled?: boolean
}

export function RecordingControls({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  onRestart,
  disabled = false,
}: RecordingControlsProps) {
  const isRecording = status === 'recording'
  const isPaused = status === 'recording_paused'
  const canRecord = status === 'pending' || status === 'recording_paused'

  return (
    <div className="flex gap-2">
      {canRecord && (
        <Button
          onClick={isPaused ? onResume : onStart}
          variant="primary"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4" />
              Resume
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Start Recording
            </>
          )}
        </Button>
      )}

      {isRecording && (
        <Button
          onClick={onPause}
          variant="secondary"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Pause className="w-4 h-4" />
          Pause
        </Button>
      )}

      {isRecording && (
        <Button
          onClick={onStop}
          variant="primary"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate Quiz
        </Button>
      )}

      {(isRecording || isPaused) && (
        <Button
          onClick={onRestart}
          variant="secondary"
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Restart
        </Button>
      )}
    </div>
  )
}

