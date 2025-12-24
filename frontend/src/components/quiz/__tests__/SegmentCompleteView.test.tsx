import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SegmentCompleteView } from '../SegmentCompleteView';

// Mock child components
vi.mock('@/components/leaderboard/SegmentLeaderboard', () => ({
  SegmentLeaderboard: ({ rankings }: { rankings: any[] }) => (
    <div>Segment Leaderboard: {rankings.length} entries</div>
  ),
}));

vi.mock('@/components/leaderboard/MasterLeaderboard', () => ({
  MasterLeaderboard: ({ rankings }: { rankings: any[] }) => (
    <div>Master Leaderboard: {rankings.length} entries</div>
  ),
}));

describe('SegmentCompleteView', () => {
  const mockSegmentLeaderboard = [
    { rank: 1, user_id: '1', username: 'SegmentWinner', score: 50 },
  ];

  const mockEventLeaderboard = [
    { rank: 1, user_id: '1', username: 'OverallLeader', score: 100 },
  ];

  const mockSegmentWinner = {
    rank: 1,
    user_id: '1',
    username: 'SegmentWinner',
    score: 50,
  };

  it('should render segment winner when provided', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        segmentWinner={mockSegmentWinner}
        isPresenter={false}
      />
    );

    expect(screen.getByText('SegmentWinner wins Round 1')).toBeInTheDocument();
    expect(screen.getByText('Score: 50 points')).toBeInTheDocument();
    expect(screen.getByTestId('trophy-icon')).toBeInTheDocument();
  });

  it('should use default title when segmentTitle is empty', () => {
    render(
      <SegmentCompleteView
        segmentTitle=""
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        segmentWinner={mockSegmentWinner}
        isPresenter={false}
      />
    );

    expect(screen.getByText('SegmentWinner wins this round')).toBeInTheDocument();
  });

  it('should show segment leaderboard by default', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={false}
      />
    );

    expect(screen.getByText('Segment Leaderboard: 1 entries')).toBeInTheDocument();
  });

  it('should toggle to overall leaderboard when button is clicked', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={false}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Overall Standings'));
    });

    expect(screen.getByText('Master Leaderboard: 1 entries')).toBeInTheDocument();
    expect(screen.queryByText('Segment Leaderboard:')).not.toBeInTheDocument();
  });

  it('should toggle back to segment leaderboard', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={false}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Overall Standings'));
    });

    act(() => {
      fireEvent.click(screen.getByText('This Segment'));
    });

    expect(screen.getByText('Segment Leaderboard: 1 entries')).toBeInTheDocument();
  });

  it('should show pass presenter button when isPresenter is true', () => {
    const onPassPresenter = vi.fn();
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={true}
        onPassPresenter={onPassPresenter}
      />
    );

    expect(screen.getByText('Pass Presenter Role')).toBeInTheDocument();
  });

  it('should call onPassPresenter when button is clicked', () => {
    const onPassPresenter = vi.fn();
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={true}
        onPassPresenter={onPassPresenter}
      />
    );

    act(() => {
      fireEvent.click(screen.getByText('Pass Presenter Role'));
    });

    expect(onPassPresenter).toHaveBeenCalledTimes(1);
  });

  it('should not show pass presenter button when isPresenter is false', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={false}
      />
    );

    expect(screen.queryByText('Pass Presenter Role')).not.toBeInTheDocument();
  });

  it('should handle missing segment winner gracefully', () => {
    render(
      <SegmentCompleteView
        segmentTitle="Round 1"
        segmentLeaderboard={mockSegmentLeaderboard}
        eventLeaderboard={mockEventLeaderboard}
        isPresenter={false}
      />
    );

    expect(screen.queryByTestId('trophy-icon')).not.toBeInTheDocument();
    expect(screen.getByText('Segment Leaderboard: 1 entries')).toBeInTheDocument();
  });
});

