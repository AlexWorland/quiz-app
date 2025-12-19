import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PresenterControls } from '../PresenterControls';

describe('PresenterControls', () => {
  const defaultProps = {
    phase: 'showing_question' as const,
    questionIndex: 0,
    totalQuestions: 5,
    allAnswered: false,
    onRevealAnswer: vi.fn(),
    onShowLeaderboard: vi.fn(),
    onNextQuestion: vi.fn(),
    onEndQuiz: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display question number', () => {
    render(<PresenterControls {...defaultProps} />);
    expect(screen.getByText('Question 1 of 5')).toBeInTheDocument();
  });

  it('should show reveal answer button when phase is showing_question', () => {
    render(<PresenterControls {...defaultProps} />);
    expect(screen.getByText('Reveal Answer')).toBeInTheDocument();
  });

  it('should show "All answered" variant when allAnswered is true', () => {
    render(<PresenterControls {...defaultProps} allAnswered={true} />);
    expect(screen.getByText('Reveal Answer (All answered)')).toBeInTheDocument();
  });

  it('should call onRevealAnswer when reveal button is clicked', () => {
    const onRevealAnswer = vi.fn();
    render(<PresenterControls {...defaultProps} onRevealAnswer={onRevealAnswer} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Reveal Answer'));
    });
    
    expect(onRevealAnswer).toHaveBeenCalledTimes(1);
  });

  it('should show leaderboard button when phase is revealing_answer', () => {
    render(<PresenterControls {...defaultProps} phase="revealing_answer" />);
    expect(screen.getByText('Show Leaderboard')).toBeInTheDocument();
  });

  it('should call onShowLeaderboard when leaderboard button is clicked', () => {
    const onShowLeaderboard = vi.fn();
    render(<PresenterControls {...defaultProps} phase="revealing_answer" onShowLeaderboard={onShowLeaderboard} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Show Leaderboard'));
    });
    
    expect(onShowLeaderboard).toHaveBeenCalledTimes(1);
  });

  it('should show next question button when phase is showing_leaderboard and not last question', () => {
    render(<PresenterControls {...defaultProps} phase="showing_leaderboard" questionIndex={0} />);
    expect(screen.getByText('Next Question')).toBeInTheDocument();
  });

  it('should call onNextQuestion when next question button is clicked', () => {
    const onNextQuestion = vi.fn();
    render(<PresenterControls {...defaultProps} phase="showing_leaderboard" onNextQuestion={onNextQuestion} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Next Question'));
    });
    
    expect(onNextQuestion).toHaveBeenCalledTimes(1);
  });

  it('should show end quiz button when phase is showing_leaderboard and is last question', () => {
    render(<PresenterControls {...defaultProps} phase="showing_leaderboard" questionIndex={4} />);
    expect(screen.getByText('End Quiz')).toBeInTheDocument();
  });

  it('should call onEndQuiz when end quiz button is clicked', () => {
    const onEndQuiz = vi.fn();
    render(<PresenterControls {...defaultProps} phase="showing_leaderboard" questionIndex={4} onEndQuiz={onEndQuiz} />);
    
    act(() => {
      fireEvent.click(screen.getByText('End Quiz'));
    });
    
    expect(onEndQuiz).toHaveBeenCalledTimes(1);
  });

  it('should handle last question correctly', () => {
    render(<PresenterControls {...defaultProps} phase="showing_leaderboard" questionIndex={4} totalQuestions={5} />);
    expect(screen.getByText('End Quiz')).toBeInTheDocument();
    expect(screen.queryByText('Next Question')).not.toBeInTheDocument();
  });
});

