import { QuizPhase } from '@/api/endpoints'
import { QuestionDisplay } from './QuestionDisplay'
import { AnswerSelection } from './AnswerSelection'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'
import { QuestionResultsChart } from '@/components/display/QuestionResultsChart'

interface ParticipantQuizViewProps {
  phase: QuizPhase
  question: {
    question_id: string
    text: string
    answers: string[]
    time_limit: number
  } | null
  revealData: {
    question_text: string
    correct_answer: string
    distribution: Array<{
      answer: string
      count: number
      is_correct: boolean
    }>
  } | null
  leaderboard: Array<{
    rank: number
    user_id: string
    username: string
    avatar_url?: string
    score: number
  }>
  hasAnswered: boolean
  onAnswer: (answer: string) => void
}

export function ParticipantQuizView({
  phase,
  question,
  revealData,
  leaderboard,
  hasAnswered,
  onAnswer
}: ParticipantQuizViewProps) {
  switch (phase) {
    case 'showing_question':
      return (
        <div>
          {question && (
            <QuestionDisplay
              questionId={question.question_id}
              text={question.text}
              timeLimit={question.time_limit}
            />
          )}
          {hasAnswered ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Waiting for other participants...</p>
            </div>
          ) : (
            question && (
              <AnswerSelection
                answers={question.answers}
                onSelect={(answer) => onAnswer(answer)}
                timeLimit={question.time_limit}
                questionStartedAt={new Date()}
              />
            )
          )}
        </div>
      )

    case 'revealing_answer':
      return (
        <div>
          {question && (
            <QuestionDisplay
              questionId={question.question_id}
              text={question.text}
              timeLimit={question.time_limit}
            />
          )}
          {revealData && (
            <>
              <QuestionResultsChart
                distribution={revealData.distribution}
                correctAnswer={revealData.correct_answer}
                totalParticipants={revealData.distribution.reduce((sum, d) => sum + d.count, 0)}
              />
              <p className="text-center mt-4 text-lg">
                Correct: <span className="font-bold text-green-600">{revealData.correct_answer}</span>
              </p>
            </>
          )}
        </div>
      )

    case 'showing_leaderboard':
      return (
        <div>
          <h2 className="text-xl font-bold mb-4">Current Standings</h2>
          <SegmentLeaderboard rankings={leaderboard} />
        </div>
      )

    case 'between_questions':
      return (
        <div className="text-center py-8">
          <p className="text-gray-600">Next question coming up...</p>
        </div>
      )

    default:
      return (
        <div className="text-center py-8">
          <p className="text-gray-600">Waiting for presenter...</p>
        </div>
      )
  }
}

