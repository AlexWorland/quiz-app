import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QuestionDisplay } from '../QuestionDisplay'

describe('QuestionDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should display the question text', () => {
    render(
      <QuestionDisplay
        questionId="q1"
        text="What is 2 + 2?"
        timeLimit={30}
      />
    )

    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
  })

  it('should display initial remaining time', () => {
    render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={30}
      />
    )

    expect(screen.getByText('30s')).toBeInTheDocument()
  })

  it('should count down from timeLimit to 0', () => {
    render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={5}
      />
    )

    expect(screen.getByText('5s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('4s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('3s')).toBeInTheDocument()
  })

  it('should call onTimeUp when timer reaches 0', () => {
    const onTimeUp = vi.fn()

    render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={3}
        onTimeUp={onTimeUp}
      />
    )

    expect(onTimeUp).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(onTimeUp).toHaveBeenCalled()
  })

  it('should reset timer when questionId changes', () => {
    const { rerender } = render(
      <QuestionDisplay
        questionId="q1"
        text="Question 1"
        timeLimit={30}
      />
    )

    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByText('20s')).toBeInTheDocument()

    rerender(
      <QuestionDisplay
        questionId="q2"
        text="Question 2"
        timeLimit={30}
      />
    )

    expect(screen.getByText('30s')).toBeInTheDocument()
  })

  it('should show red styling when time is 10 seconds or less', () => {
    render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={12}
      />
    )

    const timerElement = screen.getByText('12s')
    expect(timerElement).toHaveClass('text-blue-600')

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    const lowTimeElement = screen.getByText('10s')
    expect(lowTimeElement).toHaveClass('text-red-600')
  })

  it('should handle zero timeLimit gracefully', () => {
    const onTimeUp = vi.fn()

    render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={0}
        onTimeUp={onTimeUp}
      />
    )

    expect(screen.getByText('0s')).toBeInTheDocument()
    expect(onTimeUp).toHaveBeenCalled()
  })

  it('should cleanup interval on unmount', () => {
    const { unmount } = render(
      <QuestionDisplay
        questionId="q1"
        text="Question"
        timeLimit={30}
      />
    )

    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
  })
})
