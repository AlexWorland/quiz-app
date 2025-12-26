import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PresenterQuizView } from '../PresenterQuizView'

vi.mock('../QuestionDisplay', () => ({
  QuestionDisplay: ({ text }: { text: string }) => <div>Question: {text}</div>,
}))

vi.mock('../PresenterControls', () => ({
  PresenterControls: () => <div>Presenter Controls</div>,
}))

describe('PresenterQuizView', () => {
  const mockQuestion = {
    question_id: '1',
    text: 'What is 2+2?',
    answers: ['3', '4', '5', '6'],
    correct_answer: '4',
    time_limit: 30,
  }

  it('should highlight correct answer for presenter', () => {
    render(
      <PresenterQuizView
        phase="showing_question"
        question={mockQuestion}
        questionIndex={0}
        totalQuestions={5}
        allAnswered={false}
        onRevealAnswer={vi.fn()}
        onShowLeaderboard={vi.fn()}
        onNextQuestion={vi.fn()}
        onEndQuiz={vi.fn()}
      />
    )

    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('✓ CORRECT')).toBeInTheDocument()
    expect(screen.getByText(/Presenter view/i)).toBeInTheDocument()
  })

  it('should show all answers', () => {
    render(
      <PresenterQuizView
        phase="showing_question"
        question={mockQuestion}
        questionIndex={0}
        totalQuestions={5}
        allAnswered={false}
        onRevealAnswer={vi.fn()}
        onShowLeaderboard={vi.fn()}
        onNextQuestion={vi.fn()}
        onEndQuiz={vi.fn()}
      />
    )

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('should render presenter controls', () => {
    render(
      <PresenterQuizView
        phase="showing_question"
        question={mockQuestion}
        questionIndex={0}
        totalQuestions={5}
        allAnswered={false}
        onRevealAnswer={vi.fn()}
        onShowLeaderboard={vi.fn()}
        onNextQuestion={vi.fn()}
        onEndQuiz={vi.fn()}
      />
    )

    expect(screen.getByText('Presenter Controls')).toBeInTheDocument()
  })
})

