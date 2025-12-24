import { Button } from '@/components/common/Button'
import { QuizPhase } from '@/api/endpoints'

interface PresenterControlsProps {
  phase: QuizPhase
  questionIndex: number
  totalQuestions: number
  allAnswered: boolean
  onRevealAnswer: () => void
  onShowLeaderboard: () => void
  onNextQuestion: () => void
  onEndQuiz: () => void
  disabled?: boolean
}

export function PresenterControls({
  phase,
  questionIndex,
  totalQuestions,
  allAnswered,
  onRevealAnswer,
  onShowLeaderboard,
  onNextQuestion,
  onEndQuiz,
  disabled = false
}: PresenterControlsProps) {
  const isLastQuestion = questionIndex >= totalQuestions - 1

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <div className="text-white text-sm">
        Question {questionIndex + 1} of {totalQuestions}
      </div>

      {phase === 'showing_question' && (
        <Button
          onClick={onRevealAnswer}
          variant={allAnswered ? 'primary' : 'secondary'}
          className="w-full"
          disabled={disabled}
        >
          {allAnswered ? 'Reveal Answer (All answered)' : 'Reveal Answer'}
        </Button>
      )}

      {phase === 'revealing_answer' && (
        <Button onClick={onShowLeaderboard} className="w-full" disabled={disabled}>
          Show Leaderboard
        </Button>
      )}

      {phase === 'showing_leaderboard' && (
        <Button
          onClick={isLastQuestion ? onEndQuiz : onNextQuestion}
          className="w-full"
          disabled={disabled}
        >
          {isLastQuestion ? 'End Quiz' : 'Next Question'}
        </Button>
      )}
    </div>
  )
}

