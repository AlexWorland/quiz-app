import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCompleteView } from '../EventCompleteView';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Crown: () => <div data-testid="crown-icon">Crown</div>,
}));

// Mock child components
vi.mock('@/components/leaderboard/MasterLeaderboard', () => ({
  MasterLeaderboard: ({ rankings }: { rankings: any[] }) => (
    <div>Master Leaderboard: {rankings.length} entries</div>
  ),
}));

describe('EventCompleteView', () => {
  const mockFinalLeaderboard = [
    { rank: 1, user_id: '1', username: 'Winner', score: 100 },
    { rank: 2, user_id: '2', username: 'RunnerUp', score: 80 },
  ];

  const mockWinner = {
    rank: 1,
    user_id: '1',
    username: 'Winner',
    score: 100,
  };

  const mockSegmentWinners = [
    { segment_id: '1', segment_title: 'Round 1', winner_name: 'Winner', winner_score: 50 },
    { segment_id: '2', segment_title: 'Round 2', winner_name: 'Winner', winner_score: 50 },
  ];

  it('should render winner when provided', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        winner={mockWinner}
        segmentWinners={[]}
      />
    );

    expect(screen.getByText('Winner is the Champion')).toBeInTheDocument();
    expect(screen.getByText('Final Score: 100 points')).toBeInTheDocument();
    expect(screen.getByTestId('crown-icon')).toBeInTheDocument();
  });

  it('should render final standings', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        winner={mockWinner}
        segmentWinners={[]}
      />
    );

    expect(screen.getByText('Final Standings')).toBeInTheDocument();
    expect(screen.getByText('Master Leaderboard: 2 entries')).toBeInTheDocument();
  });

  it('should render segment winners when provided', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        winner={mockWinner}
        segmentWinners={mockSegmentWinners}
      />
    );

    expect(screen.getByText('Segment Winners')).toBeInTheDocument();
    expect(screen.getByText('Round 1')).toBeInTheDocument();
    expect(screen.getByText('Round 2')).toBeInTheDocument();
  });

  it('should display segment winner names', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        winner={mockWinner}
        segmentWinners={mockSegmentWinners}
      />
    );

    const winners = screen.getAllByText('Winner');
    expect(winners.length).toBeGreaterThan(0);
  });

  it('should handle missing winner gracefully', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        segmentWinners={[]}
      />
    );

    expect(screen.queryByText('is the Champion')).not.toBeInTheDocument();
    expect(screen.getByText('Final Standings')).toBeInTheDocument();
  });

  it('should handle empty segment winners', () => {
    render(
      <EventCompleteView
        finalLeaderboard={mockFinalLeaderboard}
        winner={mockWinner}
        segmentWinners={[]}
      />
    );

    expect(screen.queryByText('Segment Winners')).not.toBeInTheDocument();
  });

  it('should handle empty final leaderboard', () => {
    render(
      <EventCompleteView
        finalLeaderboard={[]}
        winner={mockWinner}
        segmentWinners={[]}
      />
    );

    expect(screen.getByText('Master Leaderboard: 0 entries')).toBeInTheDocument();
  });
});

