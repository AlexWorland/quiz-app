import { useState, useEffect } from 'react'

interface AnswerSelectionProps {
  answers: string[]
  onSelect: (answer: string, responseTimeMs: number) => void
  timeLimit: number
  questionStartedAt: Date
  disabled?: boolean
}

export function AnswerSelection({
  answers,
  onSelect,
  timeLimit,
  questionStartedAt,
  disabled = false,
}: AnswerSelectionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [remainingTime, setRemainingTime] = useState(timeLimit)
  const [timeExpired, setTimeExpired] = useState(false)

  // Track remaining time for client-side timeout buffer
  useEffect(() => {
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - questionStartedAt.getTime()) / 1000)
      const remaining = Math.max(0, timeLimit - elapsed)
      setRemainingTime(remaining)
      
      if (remaining <= 0) {
        setTimeExpired(true)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100) // Update every 100ms for precision

    return () => clearInterval(interval)
  }, [timeLimit, questionStartedAt])

  // Client-side buffer: disable submissions 1 second before timeout
  const isTimeBufferExpired = remainingTime <= 1
  const isSubmissionDisabled = disabled || !!selectedAnswer || timeExpired || isTimeBufferExpired

  const handleSelect = (answer: string) => {
    if (isSubmissionDisabled) return

    setSelectedAnswer(answer)
    const responseTimeMs = Date.now() - questionStartedAt.getTime()
    onSelect(answer, responseTimeMs)
  }

  const getAnswerColor = (index: number, answer: string) => {
    if (selectedAnswer === answer) {
      return 'bg-blue-600 text-white border-blue-700'
    }
    if (timeExpired) {
      return 'bg-gray-300 text-gray-600 cursor-not-allowed border-gray-400'
    }
    if (isTimeBufferExpired) {
      return 'bg-yellow-100 text-yellow-700 cursor-not-allowed border-yellow-300'
    }
    if (disabled) {
      return 'bg-gray-200 text-gray-500 cursor-not-allowed'
    }
    const colors = [
      'bg-red-100 hover:bg-red-200 border-red-300',
      'bg-blue-100 hover:bg-blue-200 border-blue-300',
      'bg-green-100 hover:bg-green-200 border-green-300',
      'bg-yellow-100 hover:bg-yellow-200 border-yellow-300',
    ]
    return colors[index % colors.length]
  }

  return (
    <div>
      {/* Time buffer warning */}
      {isTimeBufferExpired && !timeExpired && !selectedAnswer && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="text-yellow-300">⏰</div>
            <p className="text-yellow-200 text-sm">
              Time's almost up! Submissions are disabled to ensure fair scoring.
            </p>
          </div>
        </div>
      )}

      {/* Time expired message */}
      {timeExpired && !selectedAnswer && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="text-red-300">🕐</div>
            <p className="text-red-200 text-sm">
              Time's up! No more answers can be submitted for this question.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-time-limit={timeLimit}>
        {answers.map((answer, index) => (
          <button
            key={index}
            onClick={() => handleSelect(answer)}
            disabled={isSubmissionDisabled}
            className={`
              p-6 rounded-lg border-2 text-left transition-all
              ${getAnswerColor(index, answer)}
              ${!isSubmissionDisabled ? 'cursor-pointer transform hover:scale-105' : ''}
            `}
          >
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-white bg-opacity-30 flex items-center justify-center mr-4 font-bold">
                {String.fromCharCode(65 + index)}
              </div>
              <span className="text-lg font-medium">{answer}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

