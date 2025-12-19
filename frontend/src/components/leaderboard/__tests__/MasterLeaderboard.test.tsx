import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MasterLeaderboard } from '../MasterLeaderboard';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Trophy: () => <div data-testid="trophy-icon">Trophy</div>,
  Medal: () => <div data-testid="medal-icon">Medal</div>,
  Award: () => <div data-testid="award-icon">Award</div>,
}));

describe('MasterLeaderboard', () => {
  const mockRankings = [
    { rank: 1, user_id: '1', username: 'Winner', score: 100 },
    { rank: 2, user_id: '2', username: 'RunnerUp', score: 80 },
    { rank: 3, user_id: '3', username: 'Third', score: 60 },
    { rank: 4, user_id: '4', username: 'Fourth', score: 40 },
  ];

  it('should render title', () => {
    render(<MasterLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('🏆 Master Leaderboard')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(<MasterLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Aggregate scores across all segments')).toBeInTheDocument();
  });

  it('should render all rankings', () => {
    render(<MasterLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('RunnerUp')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();
  });

  it('should display scores', () => {
    render(<MasterLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('should show trophy icon for rank 1', () => {
    render(<MasterLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByTestId('trophy-icon')).toBeInTheDocument();
  });

  it('should show medal icon for rank 2', () => {
    render(<MasterLeaderboard rankings={[mockRankings[1]]} />);
    expect(screen.getByTestId('medal-icon')).toBeInTheDocument();
  });

  it('should show award icon for rank 3', () => {
    render(<MasterLeaderboard rankings={[mockRankings[2]]} />);
    expect(screen.getByTestId('award-icon')).toBeInTheDocument();
  });

  it('should show rank number for ranks above 3', () => {
    render(<MasterLeaderboard rankings={[mockRankings[3]]} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should display avatar when provided', () => {
    const rankingsWithAvatar = [
      { rank: 1, user_id: '1', username: 'User', score: 100, avatar_url: 'avatar.jpg' },
    ];
    render(<MasterLeaderboard rankings={rankingsWithAvatar} />);
    const avatar = screen.getByAltText('User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'avatar.jpg');
  });

  it('should display initial when avatar is not provided', () => {
    render(<MasterLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should display segments played when provided', () => {
    const segmentsPlayed = { '1': 3, '2': 2 };
    render(<MasterLeaderboard rankings={mockRankings} segmentsPlayed={segmentsPlayed} />);
    expect(screen.getByText('3 segments played')).toBeInTheDocument();
    expect(screen.getByText('2 segments played')).toBeInTheDocument();
  });

  it('should handle empty rankings', () => {
    render(<MasterLeaderboard rankings={[]} />);
    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });

  it('should not show segments played when not provided', () => {
    render(<MasterLeaderboard rankings={mockRankings} />);
    expect(screen.queryByText('segments played')).not.toBeInTheDocument();
  });
});

