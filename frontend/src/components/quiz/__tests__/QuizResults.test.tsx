import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuizResults } from '../QuizResults';

describe('QuizResults', () => {
  const mockDistribution = [
    { answer: 'Answer A', count: 5, is_correct: true },
    { answer: 'Answer B', count: 3, is_correct: false },
    { answer: 'Answer C', count: 2, is_correct: false },
  ];

  it('should render correct answer', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    expect(screen.getByText(/Correct Answer:/)).toBeInTheDocument();
    const answers = screen.getAllByText('Answer A');
    expect(answers.length).toBeGreaterThan(0);
  });

  it('should display user answer when provided', () => {
    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        userAnswer="Answer A"
      />
    );
    expect(screen.getByText(/Your Answer:/)).toBeInTheDocument();
    const answers = screen.getAllByText('Answer A');
    expect(answers.length).toBeGreaterThan(0);
  });

  it('should show green color for correct user answer', () => {
    const { container } = render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        userAnswer="Answer A"
      />
    );
    const userAnswerSpan = container.querySelector('.text-green-600');
    expect(userAnswerSpan).toBeInTheDocument();
  });

  it('should show red color for incorrect user answer', () => {
    const { container } = render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        userAnswer="Answer B"
      />
    );
    const userAnswerSpan = container.querySelector('.text-red-600');
    expect(userAnswerSpan).toBeInTheDocument();
  });

  it('should display points earned when provided', () => {
    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        userAnswer="Answer A"
        pointsEarned={10}
      />
    );
    expect(screen.getByText(/\+10 points/)).toBeInTheDocument();
  });

  it('should render answer distribution', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    expect(screen.getByText('Answer Distribution')).toBeInTheDocument();
    const answerA = screen.getAllByText('Answer A');
    expect(answerA.length).toBeGreaterThan(0);
    expect(screen.getByText('Answer B')).toBeInTheDocument();
    expect(screen.getByText('Answer C')).toBeInTheDocument();
  });

  it('should show checkmark for correct answers', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it('should display answer counts', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should display percentages', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('should render segment leaderboard when provided', () => {
    const segmentLeaderboard = [
      { rank: 1, user_id: '1', username: 'User1', score: 100 },
      { rank: 2, user_id: '2', username: 'User2', score: 80 },
    ];

    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        segmentLeaderboard={segmentLeaderboard}
      />
    );

    expect(screen.getByText('Segment Standings')).toBeInTheDocument();
    expect(screen.getByText('User1')).toBeInTheDocument();
    expect(screen.getByText('User2')).toBeInTheDocument();
  });

  it('should render event leaderboard when provided', () => {
    const eventLeaderboard = [
      { rank: 1, user_id: '1', username: 'User1', score: 200 },
      { rank: 2, user_id: '2', username: 'User2', score: 150 },
    ];

    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        eventLeaderboard={eventLeaderboard}
      />
    );

    expect(screen.getByText('Event Standings')).toBeInTheDocument();
    expect(screen.getByText('User1')).toBeInTheDocument();
    expect(screen.getByText('User2')).toBeInTheDocument();
  });

  it('should display medal emojis for top 3 ranks', () => {
    const segmentLeaderboard = [
      { rank: 1, user_id: '1', username: 'User1', score: 100 },
      { rank: 2, user_id: '2', username: 'User2', score: 80 },
      { rank: 3, user_id: '3', username: 'User3', score: 60 },
    ];

    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        segmentLeaderboard={segmentLeaderboard}
      />
    );

    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
  });

  it('should display rank numbers for ranks above 3', () => {
    const segmentLeaderboard = [
      { rank: 4, user_id: '4', username: 'User4', score: 40 },
    ];

    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        segmentLeaderboard={segmentLeaderboard}
      />
    );

    expect(screen.getByText('#4')).toBeInTheDocument();
  });

  it('should handle empty distribution', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={[]} />);
    expect(screen.getByText('Answer Distribution')).toBeInTheDocument();
  });

  it('should not display user answer section when userAnswer is not provided', () => {
    render(<QuizResults correctAnswer="Answer A" distribution={mockDistribution} />);
    expect(screen.queryByText(/Your Answer:/)).not.toBeInTheDocument();
  });

  it('should not display points when pointsEarned is not provided', () => {
    render(
      <QuizResults
        correctAnswer="Answer A"
        distribution={mockDistribution}
        userAnswer="Answer A"
      />
    );
    expect(screen.queryByText(/points/)).not.toBeInTheDocument();
  });
});

