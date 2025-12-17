import { useEffect, useState } from 'react'

interface QuestionDisplayProps {
  questionId: string
  text: string
  timeLimit: number
  onTimeUp?: () => void
}

export function QuestionDisplay({ questionId, text, timeLimit, onTimeUp }: QuestionDisplayProps) {
  const [remainingTime, setRemainingTime] = useState(timeLimit)

  useEffect(() => {
    setRemainingTime(timeLimit)
  }, [questionId, timeLimit])

  useEffect(() => {
    if (remainingTime <= 0) {
      onTimeUp?.()
      return
    }

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          onTimeUp?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [remainingTime, onTimeUp])

  const progress = (remainingTime / timeLimit) * 100
  const isLowTime = remainingTime <= 10

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Question</h2>
        <div className={`text-3xl font-bold ${isLowTime ? 'text-red-600' : 'text-blue-600'}`}>
          {remainingTime}s
        </div>
      </div>
      
      <div className="mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              isLowTime ? 'bg-red-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-xl text-gray-700">{text}</p>
    </div>
  )
}

