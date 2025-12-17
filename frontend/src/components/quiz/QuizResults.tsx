export interface AnswerDistribution {
  answer: string
  count: number
  is_correct: boolean
}

interface QuizResultsProps {
  correctAnswer: string
  distribution: AnswerDistribution[]
  userAnswer?: string
  pointsEarned?: number
}

export function QuizResults({
  correctAnswer,
  distribution,
  userAnswer,
  pointsEarned,
}: QuizResultsProps) {
  const totalAnswers = distribution.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Results</h2>

      <div className="mb-6">
        <p className="text-lg text-gray-700 mb-2">
          Correct Answer: <span className="font-bold text-green-600">{correctAnswer}</span>
        </p>
        {userAnswer && (
          <p className="text-lg text-gray-700">
            Your Answer:{' '}
            <span
              className={`font-bold ${
                userAnswer === correctAnswer ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {userAnswer}
            </span>
            {pointsEarned !== undefined && (
              <span className="ml-2 text-blue-600">(+{pointsEarned} points)</span>
            )}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-700">Answer Distribution</h3>
        {distribution.map((item, index) => {
          const percentage = totalAnswers > 0 ? (item.count / totalAnswers) * 100 : 0
          const barWidth = totalAnswers > 0 ? (item.count / maxCount) * 100 : 0

          return (
            <div key={index} className="flex items-center">
              <div className="w-32 text-sm font-medium text-gray-700">
                {item.answer}
                {item.is_correct && (
                  <span className="ml-2 text-green-600 font-bold">✓</span>
                )}
              </div>
              <div className="flex-1 mx-4">
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div
                    className={`h-6 rounded-full flex items-center justify-end pr-2 ${
                      item.is_correct ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                    style={{ width: `${barWidth}%` }}
                  >
                    {item.count > 0 && (
                      <span className="text-xs font-bold text-white">{item.count}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-16 text-sm text-gray-600 text-right">{percentage.toFixed(0)}%</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

