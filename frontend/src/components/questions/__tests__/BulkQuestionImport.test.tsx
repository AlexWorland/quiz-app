import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkQuestionImport } from '../BulkQuestionImport';

// Mock papaparse
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

// Mock API
vi.mock('@/api/endpoints', () => ({
  bulkImportQuestions: vi.fn(),
}));

import Papa from 'papaparse';
import { bulkImportQuestions } from '@/api/endpoints';

describe('BulkQuestionImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render CSV and JSON tabs', () => {
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    expect(screen.getByText('CSV Upload')).toBeInTheDocument();
    expect(screen.getByText('JSON Paste')).toBeInTheDocument();
  });

  it('should switch to JSON tab when clicked', () => {
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    expect(screen.getByPlaceholderText(/questions/)).toBeInTheDocument();
  });

  it('should parse CSV file', async () => {
    const mockFile = new File(['question_text,correct_answer\n"What is 2+2?","4"'], 'test.csv', { type: 'text/csv' });
    
    vi.mocked(Papa.parse).mockImplementation((file, options: any) => {
      options.complete({
        data: [{ question_text: 'What is 2+2?', correct_answer: '4' }],
        errors: [],
      });
    });
    
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      await userEvent.upload(fileInput, mockFile);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Preview (1 questions)')).toBeInTheDocument();
    });
  });

  it('should validate JSON when validate button is clicked', async () => {
    vi.mocked(bulkImportQuestions).mockResolvedValue({ data: { imported: 1, failed: 0 } } as any);
    
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    const textarea = screen.getByPlaceholderText(/questions/);
    act(() => {
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            questions: [{ question_text: 'What is 2+2?', correct_answer: '4' }],
          }),
        },
      });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Validate JSON'));
    });
    
    await waitFor(() => {
      expect(screen.getByText('Preview (1 questions)')).toBeInTheDocument();
    });
  });

  it('should show error for invalid JSON', async () => {
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    const textarea = screen.getByPlaceholderText(/questions/);
    act(() => {
      fireEvent.change(textarea, { target: { value: 'invalid json' } });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Validate JSON'));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
    });
  });

  it('should call bulkImportQuestions when import is clicked', async () => {
    vi.mocked(bulkImportQuestions).mockResolvedValue({ data: { imported: 1, failed: 0 } } as any);
    
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    const textarea = screen.getByPlaceholderText(/questions/);
    act(() => {
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            questions: [{ question_text: 'What is 2+2?', correct_answer: '4' }],
          }),
        },
      });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Validate JSON'));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Preview/)).toBeInTheDocument();
    });
    
    const importButton = screen.getByRole('button', { name: /Import \(1 questions\)/i });
    act(() => {
      fireEvent.click(importButton);
    });
    
    await waitFor(() => {
      expect(bulkImportQuestions).toHaveBeenCalledWith('seg1', {
        questions: [{ question_text: 'What is 2+2?', correct_answer: '4' }],
      });
    });
  });

  it('should call onQuestionsImported after successful import', async () => {
    vi.mocked(bulkImportQuestions).mockResolvedValue({ data: { imported: 2, failed: 0 } } as any);
    const onQuestionsImported = vi.fn();
    
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={onQuestionsImported} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    const textarea = screen.getByPlaceholderText(/questions/);
    act(() => {
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            questions: [
              { question_text: 'What is 2+2?', correct_answer: '4' },
              { question_text: 'What is 3+3?', correct_answer: '6' },
            ],
          }),
        },
      });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Validate JSON'));
    });
    
    await waitFor(() => {
      const importButton = screen.getByRole('button', { name: /Import \(2 questions\)/i });
      act(() => {
        fireEvent.click(importButton);
      });
    });
    
    await waitFor(() => {
      expect(onQuestionsImported).toHaveBeenCalledWith(2);
    });
  });

  it('should show import result', async () => {
    vi.mocked(bulkImportQuestions).mockResolvedValue({ data: { imported: 1, failed: 0 } } as any);
    
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    
    act(() => {
      fireEvent.click(screen.getByText('JSON Paste'));
    });
    
    const textarea = screen.getByPlaceholderText(/questions/);
    act(() => {
      fireEvent.change(textarea, {
        target: {
          value: JSON.stringify({
            questions: [{ question_text: 'What is 2+2?', correct_answer: '4' }],
          }),
        },
      });
    });
    
    act(() => {
      fireEvent.click(screen.getByText('Validate JSON'));
    });
    
    await waitFor(() => {
      const importButton = screen.getByRole('button', { name: /Import \(1 questions\)/i });
      act(() => {
        fireEvent.click(importButton);
      });
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Import complete: 1 of 1 questions imported/)).toBeInTheDocument();
    });
  });

  it('should disable import button when no questions', () => {
    render(<BulkQuestionImport segmentId="seg1" onQuestionsImported={vi.fn()} />);
    const importButton = screen.getByRole('button', { name: /Import/i });
    expect(importButton).toBeDisabled();
  });
});

