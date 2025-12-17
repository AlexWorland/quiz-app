import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuizResults, AnswerDistribution, LeaderboardEntry } from '../QuizResults'

const mockDistribution: AnswerDistribution[] = [
  { answer: 'Paris', count: 10, is_correct: true },
  { answer: 'London', count: 5, is_correct: false },
  { answer: 'Berlin', count: 3, is_correct: false },
  { answer: 'Madrid', count: 2, is_correct: false },
]

const mockSegmentLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: 'u1', username: 'Alice', score: 100 },
  { rank: 2, user_id: 'u2', username: 'Bob', score: 80 },
  { rank: 3, user_id: 'u3', username: 'Charlie', score: 60 },
]

const mockEventLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: 'u1', username: 'Alice', score: 500 },
  { rank: 2, user_id: 'u2', username: 'Bob', score: 400 },
]

describe('QuizResults', () => {
  it('should display the correct answer', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )

    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0)
    expect(screen.getByText(/correct answer/i)).toBeInTheDocument()
  })

  it('should display user answer when provided', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="London"
      />
    )

    expect(screen.getAllByText('London').length).toBeGreaterThan(0)
    expect(screen.getByText(/your answer/i)).toBeInTheDocument()
  })

  it('should style correct user answer in green', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="Paris"
      />
    )

    const userAnswerElements = screen.getAllByText('Paris')
    const greenElements = userAnswerElements.filter(el => el.classList.contains('text-green-600'))
    expect(greenElements.length).toBeGreaterThan(0)
  })

  it('should style incorrect user answer in red', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="London"
      />
    )

    const londonElements = screen.getAllByText('London')
    const redElements = londonElements.filter(el => el.classList.contains('text-red-600'))
    expect(redElements.length).toBeGreaterThan(0)
  })

  it('should display points earned when provided', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="Paris"
        pointsEarned={100}
      />
    )

    expect(screen.getByText(/\+100 points/)).toBeInTheDocument()
  })

  it('should display answer distribution', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )

    expect(screen.getByText('Answer Distribution')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
  })

  it('should show checkmark for correct answer in distribution', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )

    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('should display segment leaderboard when provided', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={mockSegmentLeaderboard}
      />
    )

    expect(screen.getByText('Segment Standings')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('should display event leaderboard when provided', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        eventLeaderboard={mockEventLeaderboard}
      />
    )

    expect(screen.getByText('Event Standings')).toBeInTheDocument()
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('should show medals for top 3 ranks', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={mockSegmentLeaderboard}
      />
    )

    expect(screen.getByText('🥇')).toBeInTheDocument()
    expect(screen.getByText('🥈')).toBeInTheDocument()
    expect(screen.getByText('🥉')).toBeInTheDocument()
  })

  it('should handle empty distribution', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={[]}
      />
    )

    expect(screen.getByText('Answer Distribution')).toBeInTheDocument()
  })

  it('should handle empty leaderboards gracefully', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={[]}
        eventLeaderboard={[]}
      />
    )

    expect(screen.queryByText('Segment Standings')).not.toBeInTheDocument()
    expect(screen.queryByText('Event Standings')).not.toBeInTheDocument()
  })
})
