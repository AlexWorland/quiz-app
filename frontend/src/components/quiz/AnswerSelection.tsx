import { useState } from 'react'

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

  const handleSelect = (answer: string) => {
    if (disabled || selectedAnswer) return

    setSelectedAnswer(answer)
    const responseTimeMs = Date.now() - questionStartedAt.getTime()
    onSelect(answer, responseTimeMs)
  }

  const getAnswerColor = (index: number, answer: string) => {
    if (selectedAnswer === answer) {
      return 'bg-blue-600 text-white border-blue-700'
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-time-limit={timeLimit}>
      {answers.map((answer, index) => (
        <button
          key={index}
          onClick={() => handleSelect(answer)}
          disabled={disabled || !!selectedAnswer}
          className={`
            p-6 rounded-lg border-2 text-left transition-all
            ${getAnswerColor(index, answer)}
            ${!disabled && !selectedAnswer ? 'cursor-pointer transform hover:scale-105' : ''}
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
  )
}

