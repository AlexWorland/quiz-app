import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuestionEditor } from '../QuestionEditor';

describe('QuestionEditor', () => {
  const mockQuestion = {
    question_id: '1',
    question_text: 'What is 2+2?',
    correct_answer: '4',
    segment_id: 'seg1',
    created_at: '2024-01-01',
    quality_score: null,
  };

  it('should render question text', () => {
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={vi.fn()} />);
    const textarea = screen.getByDisplayValue('What is 2+2?');
    expect(textarea).toBeInTheDocument();
  });

  it('should render correct answer', () => {
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByDisplayValue('4');
    expect(input).toBeInTheDocument();
  });

  it('should update question text when edited', () => {
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={vi.fn()} />);
    const textarea = screen.getByDisplayValue('What is 2+2?');
    
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 3+3?' } });
    });
    
    expect(textarea).toHaveValue('What is 3+3?');
  });

  it('should update correct answer when edited', () => {
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={vi.fn()} />);
    const input = screen.getByDisplayValue('4');
    
    act(() => {
      fireEvent.change(input, { target: { value: '6' } });
    });
    
    expect(input).toHaveValue('6');
  });

  it('should call onSave with updated values when save is clicked', () => {
    const onSave = vi.fn();
    render(<QuestionEditor question={mockQuestion} onSave={onSave} onCancel={vi.fn()} />);
    
    const textarea = screen.getByDisplayValue('What is 2+2?');
    act(() => {
      fireEvent.change(textarea, { target: { value: 'What is 3+3?' } });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Save'));
    });
    
    expect(onSave).toHaveBeenCalledWith({
      question_text: 'What is 3+3?',
      correct_answer: '4',
    });
  });

  it('should call onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={onCancel} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should have labels for inputs', () => {
    render(<QuestionEditor question={mockQuestion} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Question')).toBeInTheDocument();
    expect(screen.getByText('Correct Answer')).toBeInTheDocument();
  });
});

