import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuestionResultsChart } from '../QuestionResultsChart';

// Mock recharts
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  Cell: () => <div data-testid="cell" />,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

describe('QuestionResultsChart', () => {
  const mockDistribution = [
    { answer: 'A', count: 5, is_correct: true },
    { answer: 'B', count: 3, is_correct: false },
    { answer: 'C', count: 2, is_correct: false },
  ];

  it('should render title', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.getByText('Question Results')).toBeInTheDocument();
  });

  it('should render chart', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should display correct answer', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Correct Answer')).toBeInTheDocument();
  });

  it('should display percentage who got it right', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Got it right')).toBeInTheDocument();
  });

  it('should display total participants', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Total participants')).toBeInTheDocument();
  });

  it('should display average response time when provided', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
        averageResponseTime={5000}
      />
    );
    expect(screen.getByText('5s')).toBeInTheDocument();
    expect(screen.getByText('Avg response time')).toBeInTheDocument();
  });

  it('should not display average response time when not provided', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    expect(screen.queryByText('Avg response time')).not.toBeInTheDocument();
  });

  it('should handle empty distribution', () => {
    render(
      <QuestionResultsChart
        distribution={[]}
        correctAnswer="A"
        totalParticipants={0}
      />
    );
    expect(screen.getByText('Question Results')).toBeInTheDocument();
  });

  it('should calculate percentage correctly', () => {
    render(
      <QuestionResultsChart
        distribution={mockDistribution}
        correctAnswer="A"
        totalParticipants={10}
      />
    );
    // 5 out of 10 = 50%
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

