import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TranscriptView } from '../TranscriptView';

describe('TranscriptView', () => {
  it('should render transcript text', () => {
    const transcript = 'This is a test transcript.';
    render(<TranscriptView transcript={transcript} />);
    expect(screen.getByText(transcript)).toBeInTheDocument();
  });

  it('should show placeholder when transcript is empty', () => {
    render(<TranscriptView transcript="" />);
    expect(screen.getByText('No transcript yet. Start recording to see live transcription.')).toBeInTheDocument();
  });

  it('should preserve whitespace in transcript', () => {
    const transcript = 'Line 1\nLine 2\nLine 3';
    const { container } = render(<TranscriptView transcript={transcript} />);
    const textElement = container.querySelector('p');
    expect(textElement).toHaveClass('whitespace-pre-wrap');
  });

  it('should have scrollable container', () => {
    const { container } = render(<TranscriptView transcript="Test" />);
    const scrollContainer = container.querySelector('.overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
  });

  it('should have fixed height', () => {
    const { container } = render(<TranscriptView transcript="Test" />);
    const scrollContainer = container.querySelector('.h-64');
    expect(scrollContainer).toBeInTheDocument();
  });

  it('should handle long transcript', () => {
    const longTranscript = 'A'.repeat(1000);
    render(<TranscriptView transcript={longTranscript} />);
    expect(screen.getByText(longTranscript)).toBeInTheDocument();
  });

  it('should handle isLive prop', () => {
    const transcript = 'Test transcript';
    const { container } = render(<TranscriptView transcript={transcript} isLive={true} />);
    const scrollContainer = container.querySelector('.overflow-y-auto');
    expect(scrollContainer).toBeInTheDocument();
  });
});

