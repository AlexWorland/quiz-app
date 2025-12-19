import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuizReadyIndicator } from '../QuizReadyIndicator';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  CheckCircle2: () => <div data-testid="check-icon">Check</div>,
}));

describe('QuizReadyIndicator', () => {
  it('should show ready state when goodQuestionCount meets minimum', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} minQuestions={5} />);
    expect(screen.getByText('✓ Ready to quiz')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('should show generating state when goodQuestionCount is below minimum', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={3} minQuestions={5} />);
    expect(screen.getByText('Generating questions...')).toBeInTheDocument();
  });

  it('should display question counts', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} minQuestions={5} />);
    expect(screen.getByText(/5 of 5 good questions/)).toBeInTheDocument();
    expect(screen.getByText(/10 total questions/)).toBeInTheDocument();
  });

  it('should display quality threshold', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} qualityThreshold={0.7} />);
    expect(screen.getByText(/quality > 70%/)).toBeInTheDocument();
  });

  it('should use default minQuestions of 5', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} />);
    expect(screen.getByText(/5 of 5 good questions/)).toBeInTheDocument();
  });

  it('should use default qualityThreshold of 0.7', () => {
    render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} />);
    expect(screen.getByText(/quality > 70%/)).toBeInTheDocument();
  });

  it('should not show total questions when questionCount is 0', () => {
    render(<QuizReadyIndicator questionCount={0} goodQuestionCount={0} />);
    expect(screen.queryByText(/total questions/)).not.toBeInTheDocument();
  });

  it('should have green styling when ready', () => {
    const { container } = render(<QuizReadyIndicator questionCount={10} goodQuestionCount={5} />);
    const indicator = container.querySelector('.bg-green-500\\/10');
    expect(indicator).toBeInTheDocument();
  });

  it('should have yellow styling when not ready', () => {
    const { container } = render(<QuizReadyIndicator questionCount={10} goodQuestionCount={3} />);
    const indicator = container.querySelector('.bg-yellow-500\\/10');
    expect(indicator).toBeInTheDocument();
  });
});

