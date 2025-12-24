import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GeneratedQuestionList } from '../GeneratedQuestionList';

describe('GeneratedQuestionList', () => {
  const mockQuestions = [
    {
      id: '1',
      question_text: 'What is 2+2?',
      correct_answer: '4',
      segment_id: 'seg1',
      created_at: '2024-01-01',
      order_index: 0,
      quality_score: 0.9,
      source_transcript: null,
    },
    {
      id: '2',
      question_text: 'What is 3+3?',
      correct_answer: '6',
      segment_id: 'seg1',
      created_at: '2024-01-01',
      order_index: 1,
      quality_score: 0.5,
      source_transcript: null,
    },
    {
      id: '3',
      question_text: 'What is 4+4?',
      correct_answer: '8',
      segment_id: 'seg1',
      created_at: '2024-01-01',
      order_index: 2,
      quality_score: null,
      source_transcript: null,
    },
  ];

  it('should render all questions', () => {
    render(<GeneratedQuestionList questions={mockQuestions} />);
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('What is 3+3?')).toBeInTheDocument();
    expect(screen.getByText('What is 4+4?')).toBeInTheDocument();
  });

  it('should display question numbers', () => {
    render(<GeneratedQuestionList questions={mockQuestions} />);
    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(screen.getByText('Question 2')).toBeInTheDocument();
    expect(screen.getByText('Question 3')).toBeInTheDocument();
  });

  it('should display quality scores', () => {
    render(<GeneratedQuestionList questions={mockQuestions} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render stars for quality scores', () => {
    render(<GeneratedQuestionList questions={mockQuestions} />);
    const stars = screen.getAllByTestId('star-icon');
    expect(stars.length).toBeGreaterThan(0);
  });

  it('should show quality filter checkbox', () => {
    render(<GeneratedQuestionList questions={mockQuestions} showQualityFilter={true} />);
    expect(screen.getByText(/Show only quality questions/)).toBeInTheDocument();
  });

  it('should filter questions by quality when checkbox is checked', () => {
    render(<GeneratedQuestionList questions={mockQuestions} qualityThreshold={0.6} />);
    
    const checkbox = screen.getByRole('checkbox');
    act(() => {
      fireEvent.click(checkbox);
    });
    
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
    expect(screen.queryByText('What is 3+3?')).not.toBeInTheDocument();
  });

  it('should show edit button when onEdit is provided', () => {
    const onEdit = vi.fn();
    render(<GeneratedQuestionList questions={mockQuestions} onEdit={onEdit} />);
    
    const editButtons = screen.getAllByText('Edit');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn();
    render(<GeneratedQuestionList questions={mockQuestions} onEdit={onEdit} />);
    
    const editButtons = screen.getAllByText('Edit');
    act(() => {
      fireEvent.click(editButtons[0]);
    });
    
    expect(onEdit).toHaveBeenCalledWith('1');
  });

  it('should show delete button when onDelete is provided', () => {
    const onDelete = vi.fn();
    render(<GeneratedQuestionList questions={mockQuestions} onDelete={onDelete} />);
    
    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('should call onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<GeneratedQuestionList questions={mockQuestions} onDelete={onDelete} />);
    
    const deleteButtons = screen.getAllByText('Delete');
    act(() => {
      fireEvent.click(deleteButtons[0]);
    });
    
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('should show "Below threshold" warning for low quality questions', () => {
    render(<GeneratedQuestionList questions={mockQuestions} qualityThreshold={0.6} />);
    expect(screen.getByText('Below threshold')).toBeInTheDocument();
  });

  it('should display source transcript when available', () => {
    const questionsWithTranscript = [
      {
        ...mockQuestions[0],
        source_transcript: 'This is a long transcript that should be truncated...',
      },
    ];
    render(<GeneratedQuestionList questions={questionsWithTranscript} />);
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
  });

  it('should show empty message when no questions', () => {
    render(<GeneratedQuestionList questions={[]} />);
    expect(screen.getByText('No questions generated yet.')).toBeInTheDocument();
  });

  it('should show filtered empty message when filter excludes all', () => {
    render(<GeneratedQuestionList questions={mockQuestions} qualityThreshold={0.95} />);
    
    const checkbox = screen.getByRole('checkbox');
    act(() => {
      fireEvent.click(checkbox);
    });
    
    expect(screen.getByText(/No questions meet the quality threshold/)).toBeInTheDocument();
  });

  it('should not show quality filter when showQualityFilter is false', () => {
    render(<GeneratedQuestionList questions={mockQuestions} showQualityFilter={false} />);
    expect(screen.queryByText(/Show only quality questions/)).not.toBeInTheDocument();
  });

  it('should display question count in filter', () => {
    render(<GeneratedQuestionList questions={mockQuestions} />);
    expect(screen.getByText(/Showing 3 of 3 questions/)).toBeInTheDocument();
  });
});

