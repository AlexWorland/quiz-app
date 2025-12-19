import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinalResults } from '../FinalResults';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Trophy: () => <div data-testid="trophy-icon">Trophy</div>,
  Medal: () => <div data-testid="medal-icon">Medal</div>,
  Award: () => <div data-testid="award-icon">Award</div>,
}));

describe('FinalResults', () => {
  const mockRankings = [
    { rank: 1, user_id: '1', username: 'Winner', score: 100 },
    { rank: 2, user_id: '2', username: 'RunnerUp', score: 80 },
    { rank: 3, user_id: '3', username: 'Third', score: 60 },
    { rank: 4, user_id: '4', username: 'Fourth', score: 40 },
  ];

  it('should render winner', () => {
    render(<FinalResults rankings={mockRankings} totalQuestions={10} />);
    expect(screen.getByText('Winner!')).toBeInTheDocument();
    const winnerNames = screen.getAllByText('Winner');
    expect(winnerNames.length).toBeGreaterThan(0);
    expect(screen.getByText('100 points')).toBeInTheDocument();
  });

  it('should render event title when provided', () => {
    render(<FinalResults rankings={mockRankings} totalQuestions={10} eventTitle="Test Event" />);
    expect(screen.getByText('Test Event')).toBeInTheDocument();
  });

  it('should display top 3 podium', () => {
    render(<FinalResults rankings={mockRankings} totalQuestions={10} />);
    expect(screen.getByText('Top 3')).toBeInTheDocument();
    const winnerNames = screen.getAllByText('Winner');
    expect(winnerNames.length).toBeGreaterThan(0);
    expect(screen.getByText('RunnerUp')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('should display full leaderboard when more than 3 rankings', () => {
    render(<FinalResults rankings={mockRankings} totalQuestions={10} />);
    expect(screen.getByText('Full Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Fourth')).toBeInTheDocument();
  });

  it('should not show full leaderboard when 3 or fewer rankings', () => {
    const threeRankings = mockRankings.slice(0, 3);
    render(<FinalResults rankings={threeRankings} totalQuestions={10} />);
    expect(screen.queryByText('Full Leaderboard')).not.toBeInTheDocument();
  });

  it('should display total questions completed', () => {
    render(<FinalResults rankings={mockRankings} totalQuestions={15} />);
    expect(screen.getByText('Completed 15 questions')).toBeInTheDocument();
  });

  it('should display winner avatar when provided', () => {
    const rankingsWithAvatar = [
      { rank: 1, user_id: '1', username: 'Winner', score: 100, avatar_url: 'avatar.jpg' },
    ];
    render(<FinalResults rankings={rankingsWithAvatar} totalQuestions={10} />);
    const avatars = screen.getAllByAltText('Winner');
    expect(avatars.length).toBeGreaterThan(0);
    expect(avatars[0]).toHaveAttribute('src', 'avatar.jpg');
  });

  it('should display winner initial when avatar not provided', () => {
    render(<FinalResults rankings={[mockRankings[0]]} totalQuestions={10} />);
    const initials = screen.getAllByText('W');
    expect(initials.length).toBeGreaterThan(0);
  });

  it('should handle empty rankings gracefully', () => {
    render(<FinalResults rankings={[]} totalQuestions={10} />);
    expect(screen.queryByText('Winner!')).not.toBeInTheDocument();
  });
});

