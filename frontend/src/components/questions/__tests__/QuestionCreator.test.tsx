import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionCreator } from '../QuestionCreator';

// Mock API
vi.mock('@/api/endpoints', () => ({
  createQuestionForSegment: vi.fn(),
}));

import { createQuestionForSegment } from '@/api/endpoints';

describe('QuestionCreator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields', () => {
    render(<QuestionCreator segmentId="seg1" />);
    expect(screen.getByPlaceholderText('Enter your question')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter the correct answer')).toBeInTheDocument();
  });

  it('should show error when question text is empty', async () => {
    render(<QuestionCreator segmentId="seg1" />);
    
    const submitButton = screen.getByText('Add Question');
    act(() => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Question text is required')).toBeInTheDocument();
    });
  });

  it('should show error when correct answer is empty', async () => {
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
    });
    
    const submitButton = screen.getByText('Add Question');
    act(() => {
      fireEvent.click(submitButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Correct answer is required')).toBeInTheDocument();
    });
  });

  it('should call createQuestionForSegment when form is submitted', async () => {
    vi.mocked(createQuestionForSegment).mockResolvedValue({} as any);
    
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
      fireEvent.change(input, { target: { value: '4' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(createQuestionForSegment).toHaveBeenCalledWith('seg1', {
        question_text: 'What is 2+2?',
        correct_answer: '4',
      });
    });
  });

  it('should clear form after successful submission', async () => {
    vi.mocked(createQuestionForSegment).mockResolvedValue({} as any);
    
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
      fireEvent.change(input, { target: { value: '4' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(textarea).toHaveValue('');
      expect(input).toHaveValue('');
    });
  });

  it('should call onQuestionAdded callback after successful submission', async () => {
    vi.mocked(createQuestionForSegment).mockResolvedValue({} as any);
    const onQuestionAdded = vi.fn();
    
    render(<QuestionCreator segmentId="seg1" onQuestionAdded={onQuestionAdded} />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
      fireEvent.change(input, { target: { value: '4' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(onQuestionAdded).toHaveBeenCalledTimes(1);
    });
  });

  it('should show error message when API call fails', async () => {
    vi.mocked(createQuestionForSegment).mockRejectedValue(new Error('API Error'));
    
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
      fireEvent.change(input, { target: { value: '4' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('should show loading state during submission', async () => {
    let resolvePromise: () => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(createQuestionForSegment).mockReturnValue(promise as any);
    
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    const submitButton = screen.getByText('Add Question').closest('button');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 2+2?' } });
      fireEvent.change(input, { target: { value: '4' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
    
    resolvePromise!();
  });

  it('should trim whitespace from inputs', async () => {
    vi.mocked(createQuestionForSegment).mockResolvedValue({} as any);
    
    render(<QuestionCreator segmentId="seg1" />);
    
    const textarea = screen.getByPlaceholderText('Enter your question');
    const input = screen.getByPlaceholderText('Enter the correct answer');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: '  What is 2+2?  ' } });
      fireEvent.change(input, { target: { value: '  4  ' } });
    });
    
    const form = textarea.closest('form');
    act(() => {
      fireEvent.submit(form!);
    });
    
    await waitFor(() => {
      expect(createQuestionForSegment).toHaveBeenCalledWith('seg1', {
        question_text: 'What is 2+2?',
        correct_answer: '4',
      });
    });
  });
});

