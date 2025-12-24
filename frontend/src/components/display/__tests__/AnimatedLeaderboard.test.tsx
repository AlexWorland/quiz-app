import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnimatedLeaderboard } from '../AnimatedLeaderboard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('AnimatedLeaderboard', () => {
  const mockRankings = [
    { rank: 1, user_id: '1', username: 'Winner', score: 100 },
    { rank: 2, user_id: '2', username: 'RunnerUp', score: 80 },
    { rank: 3, user_id: '3', username: 'Third', score: 60 },
    { rank: 4, user_id: '4', username: 'Fourth', score: 40 },
  ];

  it('should render title', () => {
    render(<AnimatedLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('should render all rankings', () => {
    render(<AnimatedLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('Winner')).toBeInTheDocument();
    expect(screen.getByText('RunnerUp')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();
  });

  it('should display scores', () => {
    render(<AnimatedLeaderboard rankings={mockRankings} />);
    expect(screen.getByText('100 pts')).toBeInTheDocument();
    expect(screen.getByText('80 pts')).toBeInTheDocument();
  });

  it('should show trophy for rank 1', () => {
    render(<AnimatedLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByTestId('trophy-icon')).toBeInTheDocument();
  });

  it('should show medal for rank 2', () => {
    render(<AnimatedLeaderboard rankings={[mockRankings[1]]} />);
    expect(screen.getByTestId('medal-icon')).toBeInTheDocument();
  });

  it('should show award for rank 3', () => {
    render(<AnimatedLeaderboard rankings={[mockRankings[2]]} />);
    expect(screen.getByTestId('award-icon')).toBeInTheDocument();
  });

  it('should show rank number for ranks above 3', () => {
    render(<AnimatedLeaderboard rankings={[mockRankings[3]]} />);
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should display avatar when provided', () => {
    const rankingsWithAvatar = [
      { rank: 1, user_id: '1', username: 'User', score: 100, avatar_url: 'avatar.jpg' },
    ];
    render(<AnimatedLeaderboard rankings={rankingsWithAvatar} />);
    const avatar = screen.getByAltText('User');
    expect(avatar).toBeInTheDocument();
  });

  it('should display initial when avatar is not provided', () => {
    render(<AnimatedLeaderboard rankings={[mockRankings[0]]} />);
    expect(screen.getByText('W')).toBeInTheDocument();
  });

  it('should show rank changes when previousRankings provided', () => {
    const previousRankings = [
      { rank: 2, user_id: '1', username: 'Winner', score: 80 },
    ];
    render(<AnimatedLeaderboard rankings={[mockRankings[0]]} previousRankings={previousRankings} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('should show trend up icon for rank improvement', () => {
    const previousRankings = [
      { rank: 2, user_id: '1', username: 'Winner', score: 80 },
    ];
    render(<AnimatedLeaderboard rankings={[mockRankings[0]]} previousRankings={previousRankings} />);
    expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
  });

  it('should show trend down icon for rank decrease', () => {
    const previousRankings = [
      { rank: 1, user_id: '2', username: 'RunnerUp', score: 100 },
    ];
    render(<AnimatedLeaderboard rankings={[mockRankings[1]]} previousRankings={previousRankings} />);
    expect(screen.getByTestId('trending-down-icon')).toBeInTheDocument();
  });

  it('should handle empty rankings', () => {
    render(<AnimatedLeaderboard rankings={[]} />);
    expect(screen.getByText('No scores yet')).toBeInTheDocument();
  });

  it('should not show rank changes when showRankChanges is false', () => {
    const previousRankings = [
      { rank: 2, user_id: '1', username: 'Winner', score: 80 },
    ];
    render(<AnimatedLeaderboard rankings={[mockRankings[0]]} previousRankings={previousRankings} showRankChanges={false} />);
    expect(screen.queryByText('+1')).not.toBeInTheDocument();
  });
});

