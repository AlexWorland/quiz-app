import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { QuestionDisplay } from '../QuestionDisplay';

describe('QuestionDisplay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render question text', () => {
    render(<QuestionDisplay questionId="1" text="What is 2+2?" timeLimit={30} />);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  it('should display initial remaining time', () => {
    render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('should display timer countdown', () => {
    render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    
    expect(screen.getByText('30s')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('29s')).toBeInTheDocument();
  });

  it('should show blue color when time is above 10 seconds', () => {
    const { container } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    const timer = container.querySelector('.text-blue-600');
    expect(timer).toBeInTheDocument();
  });

  it('should show red color when time is 10 seconds or less', () => {
    const { container } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={15} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    const timer = container.querySelector('.text-red-600');
    expect(timer).toBeInTheDocument();
  });

  it('should call onTimeUp when time reaches zero', () => {
    const onTimeUp = vi.fn();
    render(<QuestionDisplay questionId="1" text="Test question" timeLimit={2} onTimeUp={onTimeUp} />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(onTimeUp).toHaveBeenCalled();
  });

  it('should reset timer when questionId changes', () => {
    const { rerender } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('25s')).toBeInTheDocument();

    rerender(<QuestionDisplay questionId="2" text="New question" timeLimit={30} />);
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('should reset timer when timeLimit changes', () => {
    const { rerender } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('25s')).toBeInTheDocument();

    rerender(<QuestionDisplay questionId="1" text="Test question" timeLimit={60} />);
    expect(screen.getByText('60s')).toBeInTheDocument();
  });

  it('should display progress bar', () => {
    const { container } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    const progressBar = container.querySelector('[style*="width"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should update progress bar as time decreases', () => {
    const { container } = render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    
    const initialBar = container.querySelector('[style*="width: 100%"]');
    expect(initialBar).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    
    const updatedBar = container.querySelector('[style*="width: 50%"]');
    expect(updatedBar).toBeInTheDocument();
  });

  it('should display "Question" heading', () => {
    render(<QuestionDisplay questionId="1" text="Test question" timeLimit={30} />);
    expect(screen.getByText('Question')).toBeInTheDocument();
  });

  it('should not call onTimeUp if not provided', () => {
    render(<QuestionDisplay questionId="1" text="Test question" timeLimit={2} />);
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    
    expect(screen.getByText('0s')).toBeInTheDocument();
  });
});

