import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { AnswerSelection } from '../AnswerSelection';

describe('AnswerSelection', () => {
  const mockOnSelect = vi.fn();
  const questionStartedAt = new Date();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render all answers', () => {
    const answers = ['Answer A', 'Answer B', 'Answer C', 'Answer D'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    expect(screen.getByText('Answer A')).toBeInTheDocument();
    expect(screen.getByText('Answer B')).toBeInTheDocument();
    expect(screen.getByText('Answer C')).toBeInTheDocument();
    expect(screen.getByText('Answer D')).toBeInTheDocument();
  });

  it('should display answer labels (A, B, C, D)', () => {
    const answers = ['Answer A', 'Answer B', 'Answer C', 'Answer D'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });

  it('should call onSelect when answer is clicked', () => {
    const answers = ['Answer A', 'Answer B'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const answerButton = screen.getByText('Answer A').closest('button');
    act(() => {
      fireEvent.click(answerButton!);
    });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('Answer A', expect.any(Number));
  });

  it('should not call onSelect again after answer is selected', () => {
    const answers = ['Answer A', 'Answer B'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const answerButton = screen.getByText('Answer A').closest('button');
    act(() => {
      fireEvent.click(answerButton!);
    });
    
    // Button should be disabled after first click
    expect(answerButton).toBeDisabled();
    
    // Second click should not trigger onSelect
    act(() => {
      fireEvent.click(answerButton!);
    });

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when disabled prop is true', () => {
    const answers = ['Answer A', 'Answer B'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
        disabled={true}
      />
    );

    const answerButton = screen.getByText('Answer A').closest('button');
    expect(answerButton).toBeDisabled();
    
    act(() => {
      fireEvent.click(answerButton!);
    });
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  it('should disable buttons after selection', () => {
    const answers = ['Answer A', 'Answer B'];
    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const answerButton = screen.getByText('Answer A').closest('button');
    act(() => {
      fireEvent.click(answerButton!);
    });

    const secondButton = screen.getByText('Answer B').closest('button');
    expect(secondButton).toBeDisabled();
  });

  it('should calculate response time correctly', () => {
    const answers = ['Answer A'];
    const startTime = new Date();
    vi.setSystemTime(startTime);

    render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={startTime}
      />
    );

    // Advance time by 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const answerButton = screen.getByText('Answer A').closest('button');
    act(() => {
      fireEvent.click(answerButton!);
    });

    expect(mockOnSelect).toHaveBeenCalledWith('Answer A', 5000);
  });

  it('should apply correct color classes to answers', () => {
    const answers = ['Answer A', 'Answer B', 'Answer C', 'Answer D'];
    const { container } = render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons[0]).toHaveClass('bg-red-100');
    expect(buttons[1]).toHaveClass('bg-blue-100');
    expect(buttons[2]).toHaveClass('bg-green-100');
    expect(buttons[3]).toHaveClass('bg-yellow-100');
  });

  it('should highlight selected answer', () => {
    const answers = ['Answer A', 'Answer B'];
    const { container } = render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const answerButton = screen.getByText('Answer A').closest('button');
    act(() => {
      fireEvent.click(answerButton!);
    });

    expect(answerButton).toHaveClass('bg-blue-600');
  });

  it('should have time limit data attribute', () => {
    const answers = ['Answer A'];
    const { container } = render(
      <AnswerSelection
        answers={answers}
        onSelect={mockOnSelect}
        timeLimit={30}
        questionStartedAt={questionStartedAt}
      />
    );

    const wrapper = container.querySelector('[data-time-limit]');
    expect(wrapper).toHaveAttribute('data-time-limit', '30');
  });
});

