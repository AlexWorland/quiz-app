interface AnswerProgressProps {
  answeredCount: number
  totalParticipants: number
  allAnswered: boolean
}

export function AnswerProgress({
  answeredCount,
  totalParticipants,
  allAnswered
}: AnswerProgressProps) {
  const percentage = totalParticipants > 0
    ? (answeredCount / totalParticipants) * 100
    : 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-300">
        <span>Answers received</span>
        <span className="font-semibold">{answeredCount} / {totalParticipants}</span>
      </div>

      <div className="w-full bg-dark-700 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all ${
            allAnswered ? 'bg-green-500' : 'bg-cyan-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {allAnswered && (
        <p className="text-green-400 font-medium text-center">
          All participants have answered
        </p>
      )}
    </div>
  )
}

