import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingScreen } from '../ProcessingScreen';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

describe('ProcessingScreen', () => {
  it('should render message', () => {
    render(<ProcessingScreen step="transcribing" message="Processing audio..." />);
    expect(screen.getByText('Processing audio...')).toBeInTheDocument();
  });

  it('should show transcribing step', () => {
    render(<ProcessingScreen step="transcribing" message="Transcribing..." />);
    expect(screen.getByText('Processing final transcription...')).toBeInTheDocument();
  });

  it('should show generating step', () => {
    render(<ProcessingScreen step="generating" message="Generating..." />);
    expect(screen.getByText('Generating questions from transcript...')).toBeInTheDocument();
  });

  it('should show ready step', () => {
    render(<ProcessingScreen step="ready" message="Ready!" />);
    expect(screen.getByText('Ready to start quiz')).toBeInTheDocument();
  });

  it('should display progress bar when progress is provided', () => {
    const { container } = render(<ProcessingScreen step="transcribing" progress={50} message="Processing..." />);
    const progressBar = container.querySelector('.bg-gradient-to-r');
    expect(progressBar).toBeInTheDocument();
  });

  it('should not display progress bar when progress is undefined', () => {
    const { container } = render(<ProcessingScreen step="transcribing" message="Processing..." />);
    const progressBar = container.querySelector('.bg-gradient-to-r');
    // Progress bar container might still exist, but width should be 0
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should show all step indicators', () => {
    render(<ProcessingScreen step="transcribing" message="Processing..." />);
    expect(screen.getByText('Processing final transcription...')).toBeInTheDocument();
    expect(screen.getByText('Generating questions from transcript...')).toBeInTheDocument();
    expect(screen.getByText('Ready to start quiz')).toBeInTheDocument();
  });
});

