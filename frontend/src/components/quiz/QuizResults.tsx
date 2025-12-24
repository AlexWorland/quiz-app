export interface AnswerDistribution {
  answer: string
  count: number
  is_correct: boolean
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
}

interface QuizResultsProps {
  correctAnswer: string
  distribution: AnswerDistribution[]
  userAnswer?: string
  pointsEarned?: number
  segmentLeaderboard?: LeaderboardEntry[]
  eventLeaderboard?: LeaderboardEntry[]
}

export function QuizResults({
  correctAnswer,
  distribution,
  userAnswer,
  pointsEarned,
  segmentLeaderboard,
  eventLeaderboard,
}: QuizResultsProps) {
  const totalAnswers = distribution.reduce((sum, d) => sum + d.count, 0)
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)
  const maxSegmentScore = Math.max(...(segmentLeaderboard?.map((e) => e.score) || []), 1)
  const maxEventScore = Math.max(...(eventLeaderboard?.map((e) => e.score) || []), 1)
  
  // Check if no one got points in this question
  const noOneGotPoints = pointsEarned === 0 || pointsEarned === undefined
  const allParticipantsZero = segmentLeaderboard?.every(e => e.score === 0) || eventLeaderboard?.every(e => e.score === 0)

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
        
        {/* Encouraging message for zero-score scenarios */}
        {allParticipantsZero && (
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded">
            <div className="flex items-center">
              <div className="text-2xl mr-3">🤔</div>
              <div>
                <p className="font-semibold text-blue-800">Tough question!</p>
                <p className="text-blue-700 text-sm mt-1">
                  No worries, that was a challenging one. Let's try the next question!
                </p>
              </div>
            </div>
          </div>
        )}
        
        {noOneGotPoints && !userAnswer && totalAnswers === 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <div className="flex items-center">
              <div className="text-2xl mr-3">⏰</div>
              <div>
                <p className="font-semibold text-yellow-800">Time's up!</p>
                <p className="text-yellow-700 text-sm mt-1">
                  No one answered this question in time. The next one might be easier!
                </p>
              </div>
            </div>
          </div>
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

      {(segmentLeaderboard?.length || eventLeaderboard?.length) && (
        <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
          {segmentLeaderboard && segmentLeaderboard.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-700">Segment Standings</h3>
              {segmentLeaderboard.map((entry) => {
                const barWidth = (entry.score / maxSegmentScore) * 100

                return (
                  <div key={entry.user_id} className="flex items-center">
                    <div className="w-8 text-sm font-bold text-gray-600">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </div>
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">
                      {entry.username}
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full bg-gray-200 rounded-full h-5">
                        <div
                          className="h-5 rounded-full flex items-center justify-end pr-2 bg-blue-500"
                          style={{ width: `${Math.max(barWidth, 10)}%` }}
                        >
                          <span className="text-xs font-bold text-white">{entry.score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {eventLeaderboard && eventLeaderboard.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-700">Event Standings</h3>
              {eventLeaderboard.map((entry) => {
                const barWidth = (entry.score / maxEventScore) * 100

                return (
                  <div key={entry.user_id} className="flex items-center">
                    <div className="w-8 text-sm font-bold text-gray-600">
                      {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                    </div>
                    <div className="w-24 text-sm font-medium text-gray-700 truncate">
                      {entry.username}
                    </div>
                    <div className="flex-1 mx-2">
                      <div className="w-full bg-gray-200 rounded-full h-5">
                        <div
                          className="h-5 rounded-full flex items-center justify-end pr-2 bg-purple-500"
                          style={{ width: `${Math.max(barWidth, 10)}%` }}
                        >
                          <span className="text-xs font-bold text-white">{entry.score}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

