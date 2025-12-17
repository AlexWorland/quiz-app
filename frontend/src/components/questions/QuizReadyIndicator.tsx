import { CheckCircle2 } from 'lucide-react'

interface QuizReadyIndicatorProps {
  questionCount: number
  goodQuestionCount: number
  minQuestions?: number
  qualityThreshold?: number
}

export function QuizReadyIndicator({
  questionCount,
  goodQuestionCount,
  minQuestions = 5,
  qualityThreshold = 0.7,
}: QuizReadyIndicatorProps) {
  const isReady = goodQuestionCount >= minQuestions

  return (
    <div
      className={`rounded-lg p-4 border-2 ${
        isReady
          ? 'bg-green-500/10 border-green-500 text-green-400'
          : 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
      }`}
    >
      <div className="flex items-center gap-2">
        {isReady ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-current animate-pulse" />
        )}
        <div>
          <div className="font-semibold">
            {isReady ? '✓ Ready to quiz' : 'Generating questions...'}
          </div>
          <div className="text-sm mt-1">
            {goodQuestionCount} of {minQuestions} good questions (quality &gt;{' '}
            {Math.round(qualityThreshold * 100)}%)
            {questionCount > 0 && (
              <span className="ml-2">
                ({questionCount} total questions)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

