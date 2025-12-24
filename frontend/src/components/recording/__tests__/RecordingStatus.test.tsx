import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { RecordingStatus } from '../RecordingStatus';

describe('RecordingStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show NOT STARTED when status is pending', () => {
    render(<RecordingStatus status="pending" />);
    expect(screen.getByText('NOT STARTED')).toBeInTheDocument();
  });

  it('should show LIVE when status is recording', () => {
    render(<RecordingStatus status="recording" startedAt={new Date().toISOString()} />);
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByTestId('radio-icon')).toBeInTheDocument();
  });

  it('should show PAUSED when status is recording_paused', () => {
    render(<RecordingStatus status="recording_paused" />);
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
  });

  it('should show READY FOR QUIZ when status is quiz_ready', () => {
    render(<RecordingStatus status="quiz_ready" />);
    expect(screen.getByText('READY FOR QUIZ')).toBeInTheDocument();
  });

  it('should show QUIZ IN PROGRESS when status is quizzing', () => {
    render(<RecordingStatus status="quizzing" />);
    expect(screen.getByText('QUIZ IN PROGRESS')).toBeInTheDocument();
  });

  it('should show COMPLETED when status is completed', () => {
    render(<RecordingStatus status="completed" />);
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('should display elapsed time when recording', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    vi.setSystemTime(startTime);

    render(<RecordingStatus status="recording" startedAt={startTime.toISOString()} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    
    expect(screen.getByText('00:05')).toBeInTheDocument();
  });

  it('should update elapsed time every second', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    vi.setSystemTime(startTime);

    render(<RecordingStatus status="recording" startedAt={startTime.toISOString()} />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('00:01')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('00:03')).toBeInTheDocument();
  });

  it('should format time correctly for minutes', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    vi.setSystemTime(startTime);

    render(<RecordingStatus status="recording" startedAt={startTime.toISOString()} />);
    
    act(() => {
      vi.advanceTimersByTime(65000); // 1 minute 5 seconds
    });
    
    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('should reset elapsed time when status changes from recording', () => {
    const startTime = new Date('2024-01-01T10:00:00Z');
    vi.setSystemTime(startTime);

    const { rerender } = render(<RecordingStatus status="recording" startedAt={startTime.toISOString()} />);
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('00:05')).toBeInTheDocument();
    
    rerender(<RecordingStatus status="pending" />);
    expect(screen.queryByText('00:05')).not.toBeInTheDocument();
  });

  it('should not show elapsed time when not recording', () => {
    render(<RecordingStatus status="pending" />);
    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });

  it('should not show radio icon when not recording', () => {
    render(<RecordingStatus status="pending" />);
    expect(screen.queryByTestId('radio-icon')).not.toBeInTheDocument();
  });
});

