import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RecordingControls } from '../RecordingControls';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Play: () => <div data-testid="play-icon">Play</div>,
  Pause: () => <div data-testid="pause-icon">Pause</div>,
  Square: () => <div data-testid="square-icon">Square</div>,
  RotateCcw: () => <div data-testid="restart-icon">Restart</div>,
}));

describe('RecordingControls', () => {
  const defaultProps = {
    status: 'pending' as const,
    onStart: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onStop: vi.fn(),
    onRestart: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show start button when status is pending', () => {
    render(<RecordingControls {...defaultProps} />);
    expect(screen.getByText('Start Recording')).toBeInTheDocument();
  });

  it('should call onStart when start button is clicked', () => {
    const onStart = vi.fn();
    render(<RecordingControls {...defaultProps} onStart={onStart} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Start Recording'));
    });
    
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('should show pause and stop buttons when recording', () => {
    render(<RecordingControls {...defaultProps} status="recording" />);
    expect(screen.getByRole('button', { name: /Pause/i })).toBeInTheDocument();
    expect(screen.getByText('Stop & Start Quiz')).toBeInTheDocument();
  });

  it('should call onPause when pause button is clicked', () => {
    const onPause = vi.fn();
    render(<RecordingControls {...defaultProps} status="recording" onPause={onPause} />);
    
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Pause/i }));
    });
    
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('should call onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    render(<RecordingControls {...defaultProps} status="recording" onStop={onStop} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Stop & Start Quiz'));
    });
    
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('should show resume button when paused', () => {
    render(<RecordingControls {...defaultProps} status="recording_paused" />);
    expect(screen.getByText('Resume')).toBeInTheDocument();
  });

  it('should call onResume when resume button is clicked', () => {
    const onResume = vi.fn();
    render(<RecordingControls {...defaultProps} status="recording_paused" onResume={onResume} />);
    
    act(() => {
      fireEvent.click(screen.getByText('Resume'));
    });
    
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('should show restart button when recording', () => {
    render(<RecordingControls {...defaultProps} status="recording" />);
    expect(screen.getByRole('button', { name: /Restart/i })).toBeInTheDocument();
  });

  it('should show restart button when paused', () => {
    render(<RecordingControls {...defaultProps} status="recording_paused" />);
    expect(screen.getByRole('button', { name: /Restart/i })).toBeInTheDocument();
  });

  it('should call onRestart when restart button is clicked', () => {
    const onRestart = vi.fn();
    render(<RecordingControls {...defaultProps} status="recording" onRestart={onRestart} />);
    
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /Restart/i }));
    });
    
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when disabled prop is true', () => {
    render(<RecordingControls {...defaultProps} disabled={true} />);
    const button = screen.getByText('Start Recording').closest('button');
    expect(button).toBeDisabled();
  });

  it('should not show recording controls when status is quiz_ready', () => {
    render(<RecordingControls {...defaultProps} status="quiz_ready" />);
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
  });

  it('should not show recording controls when status is quizzing', () => {
    render(<RecordingControls {...defaultProps} status="quizzing" />);
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
  });

  it('should not show recording controls when status is completed', () => {
    render(<RecordingControls {...defaultProps} status="completed" />);
    expect(screen.queryByText('Start Recording')).not.toBeInTheDocument();
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
  });
});

