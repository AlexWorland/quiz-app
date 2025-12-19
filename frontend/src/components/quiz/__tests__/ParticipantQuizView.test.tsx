import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ParticipantQuizView } from '../ParticipantQuizView';

// Mock child components
vi.mock('../QuestionDisplay', () => ({
  QuestionDisplay: ({ text }: { text: string }) => <div>Question: {text}</div>,
}));

vi.mock('../AnswerSelection', () => ({
  AnswerSelection: ({ answers, onSelect }: { answers: string[]; onSelect: (a: string) => void }) => (
    <div>
      {answers.map((a, i) => (
        <button key={i} onClick={() => onSelect(a)}>
          {a}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/leaderboard/SegmentLeaderboard', () => ({
  SegmentLeaderboard: ({ rankings }: { rankings: any[] }) => (
    <div>Segment Leaderboard: {rankings.length} entries</div>
  ),
}));

vi.mock('@/components/display/QuestionResultsChart', () => ({
  QuestionResultsChart: ({ correctAnswer }: { correctAnswer: string }) => (
    <div>Correct: {correctAnswer}</div>
  ),
}));

describe('ParticipantQuizView', () => {
  const mockQuestion = {
    question_id: '1',
    text: 'What is 2+2?',
    answers: ['3', '4', '5', '6'],
    time_limit: 30,
  };

  const mockRevealData = {
    question_text: 'What is 2+2?',
    correct_answer: '4',
    distribution: [
      { answer: '3', count: 2, is_correct: false },
      { answer: '4', count: 8, is_correct: true },
    ],
  };

  const mockLeaderboard = [
    { rank: 1, user_id: '1', username: 'User1', score: 100 },
    { rank: 2, user_id: '2', username: 'User2', score: 80 },
  ];

  it('should render question display when phase is showing_question', () => {
    render(
      <ParticipantQuizView
        phase="showing_question"
        question={mockQuestion}
        revealData={null}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Question: What is 2+2?')).toBeInTheDocument();
  });

  it('should render answer selection when hasAnswered is false', () => {
    const onAnswer = vi.fn();
    render(
      <ParticipantQuizView
        phase="showing_question"
        question={mockQuestion}
        revealData={null}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={onAnswer}
      />
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    
    act(() => {
      fireEvent.click(screen.getByText('4'));
    });
    
    expect(onAnswer).toHaveBeenCalledWith('4');
  });

  it('should show waiting message when hasAnswered is true', () => {
    render(
      <ParticipantQuizView
        phase="showing_question"
        question={mockQuestion}
        revealData={null}
        leaderboard={[]}
        hasAnswered={true}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Waiting for other participants...')).toBeInTheDocument();
  });

  it('should render reveal data when phase is revealing_answer', () => {
    render(
      <ParticipantQuizView
        phase="revealing_answer"
        question={mockQuestion}
        revealData={mockRevealData}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Question: What is 2+2?')).toBeInTheDocument();
    expect(screen.getByText('Correct: 4')).toBeInTheDocument();
  });

  it('should render leaderboard when phase is showing_leaderboard', () => {
    render(
      <ParticipantQuizView
        phase="showing_leaderboard"
        question={null}
        revealData={null}
        leaderboard={mockLeaderboard}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Current Standings')).toBeInTheDocument();
    expect(screen.getByText('Segment Leaderboard: 2 entries')).toBeInTheDocument();
  });

  it('should render waiting message when phase is between_questions', () => {
    render(
      <ParticipantQuizView
        phase="between_questions"
        question={null}
        revealData={null}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Next question coming up...')).toBeInTheDocument();
  });

  it('should render default waiting message for unknown phase', () => {
    render(
      <ParticipantQuizView
        phase="not_started" as any
        question={null}
        revealData={null}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.getByText('Waiting for presenter...')).toBeInTheDocument();
  });

  it('should handle null question gracefully', () => {
    render(
      <ParticipantQuizView
        phase="showing_question"
        question={null}
        revealData={null}
        leaderboard={[]}
        hasAnswered={false}
        onAnswer={vi.fn()}
      />
    );

    expect(screen.queryByText('Question:')).not.toBeInTheDocument();
  });
});

