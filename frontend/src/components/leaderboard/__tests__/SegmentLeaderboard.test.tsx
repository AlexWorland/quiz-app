import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SegmentLeaderboard } from '../SegmentLeaderboard';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Trophy: () => <div data-testid="trophy-icon">Trophy</div>,
  Medal: () => <div data-testid="medal-icon">Medal</div>,
  Award: () => <div data-testid="award-icon">Award</div>,
}));

describe('SegmentLeaderboard', () => {
  const mockRankings = [
    { rank: 1, user_id: '1', username: 'Winner', score: 50 },
    { rank: 2, user_id: '2', username: 'RunnerUp', score: 40 },
    { rank: 3, user_id: '3', username: 'Third', score: 30 },
    { rank: 4, user_id: '4', username: 'Fourth', score: 20 },
  ];

  it('should render title', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Segment Leaderboard')).toBeInTheDocument();
  });

  it('should render all rankings', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('RunnerUp')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();
  });

  it('should display scores', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('should show trophy icon for rank 1', () => {
    render(<SegmentLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByTestId('trophy-icon')).toBeInTheDocument();
  });

  it('should show medal icon for rank 2', () => {
    render(<SegmentLeaderboard rankings={[mockRankings[1]]} />);
    expect(screen.getByTestId('medal-icon')).toBeInTheDocument();
  });

  it('should show award icon for rank 3', () => {
    render(<SegmentLeaderboard rankings={[mockRankings[2]]} />);
    expect(screen.getByTestId('award-icon')).toBeInTheDocument();
  });

  it('should show rank number for ranks above 3', () => {
    render(<SegmentLeaderboard rankings={[mockRankings[3]]} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should display avatar when provided', () => {
    const rankingsWithAvatar = [
      { rank: 1, user_id: '1', username: 'User', score: 50, avatar_url: 'avatar.jpg' },
    ];
    render(<SegmentLeaderboard rankings={rankingsWithAvatar} />);
    const avatar = screen.getByAltText('User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'avatar.jpg');
  });

  it('should display initial when avatar is not provided', () => {
    render(<SegmentLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should handle empty rankings', () => {
    render(<SegmentLeaderboard rankings={[]} />);
    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });
});

