import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerProgress } from '../AnswerProgress';

describe('AnswerProgress', () => {
  it('should render answered count and total participants', () => {
    render(<AnswerProgress answeredCount={5} totalParticipants={10} allAnswered={false} />);
    expect(screen.getByText('Answers received')).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });

  it('should calculate percentage correctly', () => {
    const { container } = render(<AnswerProgress answeredCount={3} totalParticipants={10} allAnswered={false} />);
    const progressBar = container.querySelector('[style*="width: 30%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show cyan color when not all answered', () => {
    const { container } = render(<AnswerProgress answeredCount={5} totalParticipants={10} allAnswered={false} />);
    const progressBar = container.querySelector('.bg-cyan-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show green color when all answered', () => {
    const { container } = render(<AnswerProgress answeredCount={10} totalParticipants={10} allAnswered={true} />);
    const progressBar = container.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('should display "All participants have answered" when allAnswered is true', () => {
    render(<AnswerProgress answeredCount={10} totalParticipants={10} allAnswered={true} />);
    expect(screen.getByText('All participants have answered')).toBeInTheDocument();
  });

  it('should not display "All participants have answered" when allAnswered is false', () => {
    render(<AnswerProgress answeredCount={5} totalParticipants={10} allAnswered={false} />);
    expect(screen.queryByText('All participants have answered')).not.toBeInTheDocument();
  });

  it('should handle zero total participants', () => {
    render(<AnswerProgress answeredCount={0} totalParticipants={0} allAnswered={false} />);
    expect(screen.getByText('0 / 0')).toBeInTheDocument();
  });

  it('should handle 100% completion', () => {
    const { container } = render(<AnswerProgress answeredCount={10} totalParticipants={10} allAnswered={true} />);
    const progressBar = container.querySelector('[style*="width: 100%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle partial completion', () => {
    const { container } = render(<AnswerProgress answeredCount={7} totalParticipants={10} allAnswered={false} />);
    const progressBar = container.querySelector('[style*="width: 70%"]');
    expect(progressBar).toBeInTheDocument();
  });
});

