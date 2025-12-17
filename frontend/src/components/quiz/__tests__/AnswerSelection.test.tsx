import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnswerSelection } from '../AnswerSelection'

describe('AnswerSelection', () => {
  const mockAnswers = ['Paris', 'London', 'Berlin', 'Madrid']
  const mockOnSelect = vi.fn()
  const mockQuestionStartedAt = new Date('2024-01-01T12:00:00Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-01T12:00:02Z'))
  })

  it('should render all answer buttons', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('Madrid')).toBeInTheDocument()
  })

  it('should display A/B/C/D labels', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })

  it('should call onSelect with answer and response time when clicked', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    fireEvent.click(screen.getByText('Paris'))

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
    expect(mockOnSelect).toHaveBeenCalledWith('Paris', expect.any(Number))
  })

  it('should disable buttons after selection', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    fireEvent.click(screen.getByText('Paris'))

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('should not call onSelect twice for same question', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    fireEvent.click(screen.getByText('Paris'))
    fireEvent.click(screen.getByText('London'))

    expect(mockOnSelect).toHaveBeenCalledTimes(1)
  })

  it('should highlight selected answer', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
      />
    )

    fireEvent.click(screen.getByText('Paris'))

    const parisButton = screen.getByText('Paris').closest('button')
    expect(parisButton).toHaveClass('bg-blue-600')
  })

  it('should disable all buttons when disabled prop is true', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
        disabled={true}
      />
    )

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('should not call onSelect when disabled', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
        disabled={true}
      />
    )

    fireEvent.click(screen.getByText('Paris'))

    expect(mockOnSelect).not.toHaveBeenCalled()
  })

  it('should apply disabled styling when disabled', () => {
    render(
      <AnswerSelection
        answers={mockAnswers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={mockQuestionStartedAt}
        disabled={true}
      />
    )

    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toHaveClass('cursor-not-allowed')
    })
  })
})
