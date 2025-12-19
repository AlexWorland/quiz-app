import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DisplayModeContainer } from '../DisplayModeContainer';

// Mock child components
vi.mock('../ProcessingScreen', () => ({
  ProcessingScreen: ({ message }: { message: string }) => <div>Processing: {message}</div>,
}));

vi.mock('../AnimatedLeaderboard', () => ({
  AnimatedLeaderboard: ({ rankings }: { rankings: any[] }) => (
    <div>Leaderboard: {rankings.length} entries</div>
  ),
}));

vi.mock('../QuestionResultsChart', () => ({
  QuestionResultsChart: ({ correctAnswer }: { correctAnswer: string }) => (
    <div>Results: {correctAnswer}</div>
  ),
}));

vi.mock('../FinalResults', () => ({
  FinalResults: ({ totalQuestions }: { totalQuestions: number }) => (
    <div>Final Results: {totalQuestions} questions</div>
  ),
}));

describe('DisplayModeContainer', () => {
  const mockRankings = [
    { rank: 1, user_id: '1', username: 'User1', score: 100 },
  ];

  it('should show processing screen when processingStatus is provided', () => {
    render(
      <DisplayModeContainer
        processingStatus={{ step: 'transcribing', message: 'Processing...' }}
      />
    );
    expect(screen.getByText('Processing: Processing...')).toBeInTheDocument();
  });

  it('should show leaderboard when rankings are provided', () => {
    render(<DisplayModeContainer rankings={mockRankings} />);
    expect(screen.getByText('Leaderboard: 1 entries')).toBeInTheDocument();
  });

  it('should show question results when questionResults is provided', () => {
    const questionResults = {
      distribution: [{ answer: 'A', count: 5, is_correct: true }],
      correctAnswer: 'A',
      totalParticipants: 10,
    };
    render(<DisplayModeContainer questionResults={questionResults} />);
    expect(screen.getByText('Results: A')).toBeInTheDocument();
  });

  it('should show final results when finalResults is provided', () => {
    const finalResults = {
      rankings: mockRankings,
      totalQuestions: 10,
    };
    render(<DisplayModeContainer finalResults={finalResults} />);
    expect(screen.getByText('Final Results: 10 questions')).toBeInTheDocument();
  });

  it('should prioritize processingStatus over other modes', () => {
    render(
      <DisplayModeContainer
        processingStatus={{ step: 'generating', message: 'Generating...' }}
        rankings={mockRankings}
      />
    );
    expect(screen.getByText('Processing: Generating...')).toBeInTheDocument();
  });

  it('should use displayMode when provided', () => {
    render(
      <DisplayModeContainer
        displayMode={{ mode: 'question_results' }}
        questionResults={{
          distribution: [{ answer: 'B', count: 3, is_correct: false }],
          correctAnswer: 'B',
          totalParticipants: 10,
        }}
      />
    );
    expect(screen.getByText('Results: B')).toBeInTheDocument();
  });

  it('should show default processing screen when nothing is provided', () => {
    render(<DisplayModeContainer />);
    expect(screen.getByText('Processing: Waiting for quiz to start...')).toBeInTheDocument();
  });

  it('should show leaderboard as fallback when no other mode', () => {
    render(<DisplayModeContainer rankings={mockRankings} />);
    expect(screen.getByText('Leaderboard: 1 entries')).toBeInTheDocument();
  });
});

