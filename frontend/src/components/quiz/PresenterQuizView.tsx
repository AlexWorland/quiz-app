import { QuestionDisplay } from './QuestionDisplay'
import { PresenterControls } from './PresenterControls'
import { QuizPhase } from '@/api/endpoints'

interface PresenterQuizViewProps {
  phase: QuizPhase
  question: {
    question_id: string
    text: string
    answers: string[]
    correct_answer: string
    time_limit: number
  } | null
  questionIndex: number
  totalQuestions: number
  allAnswered: boolean
  onRevealAnswer: () => void
  onShowLeaderboard: () => void
  onNextQuestion: () => void
  onEndQuiz: () => void
}

export function PresenterQuizView({
  phase,
  question,
  questionIndex,
  totalQuestions,
  allAnswered,
  onRevealAnswer,
  onShowLeaderboard,
  onNextQuestion,
  onEndQuiz
}: PresenterQuizViewProps) {
  return (
    <div>
      {question && (
        <>
          <QuestionDisplay
            questionId={question.question_id}
            text={question.text}
            timeLimit={question.time_limit}
          />
          
          {phase === 'showing_question' && (
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-4 text-center">
                Presenter view - Correct answer highlighted
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {question.answers.map((answer, index) => {
                  const isCorrect = answer === question.correct_answer
                  return (
                    <div
                      key={index}
                      className={`
                        p-6 rounded-lg border-2
                        ${isCorrect 
                          ? 'bg-green-500/20 border-green-500 ring-2 ring-green-400' 
                          : 'bg-gray-700 border-gray-600'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center mr-4 font-bold">
                            {String.fromCharCode(65 + index)}
                          </div>
                          <span className="text-lg font-medium text-white">
                            {answer}
                          </span>
                        </div>
                        {isCorrect && (
                          <span className="text-green-400 font-bold text-sm">
                            ✓ CORRECT
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
      
      <PresenterControls
        phase={phase}
        questionIndex={questionIndex}
        totalQuestions={totalQuestions}
        allAnswered={allAnswered}
        onRevealAnswer={onRevealAnswer}
        onShowLeaderboard={onShowLeaderboard}
        onNextQuestion={onNextQuestion}
        onEndQuiz={onEndQuiz}
      />
    </div>
  )
}

