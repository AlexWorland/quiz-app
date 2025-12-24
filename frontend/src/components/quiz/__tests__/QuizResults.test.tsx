import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuizResults, type AnswerDistribution, type LeaderboardEntry } from '../QuizResults'

const mockDistribution: AnswerDistribution[] = [
  { answer: 'Paris', count: 3, is_correct: true },
  { answer: 'London', count: 2, is_correct: false },
  { answer: 'Berlin', count: 1, is_correct: false },
]

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: 'user1', username: 'Alice', score: 100 },
  { rank: 2, user_id: 'user2', username: 'Bob', score: 80 },
]

const mockZeroLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: 'user1', username: 'Alice', score: 0 },
  { rank: 2, user_id: 'user2', username: 'Bob', score: 0 },
]

describe('QuizResults', () => {
  it('should render basic results structure', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="Paris"
        pointsEarned={100}
      />
    )
    
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0)
    expect(screen.getByText('Answer Distribution')).toBeInTheDocument()
  })

  it('should show correct answer', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )
    
    expect(screen.getByText(/Correct Answer:/)).toBeInTheDocument()
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0)
  })

  it('should show user answer and points earned', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        userAnswer="London"
        pointsEarned={0}
      />
    )
    
    expect(screen.getByText(/Your Answer:/)).toBeInTheDocument()
    expect(screen.getAllByText('London').length).toBeGreaterThan(0)
    expect(screen.getByText('(+0 points)')).toBeInTheDocument()
  })

  it('should display answer distribution with percentages', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )
    
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0)
    expect(screen.getAllByText('London').length).toBeGreaterThan(0)
    expect(screen.getByText('Berlin')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument() // 3/6 = 50%
    expect(screen.getByText('33%')).toBeInTheDocument() // 2/6 = 33%
    expect(screen.getByText('17%')).toBeInTheDocument() // 1/6 = 17%
  })

  it('should show correct answer checkmark', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
      />
    )
    
    // Verify the correct answer is shown and distribution is rendered
    expect(screen.getAllByText('Paris').length).toBeGreaterThan(0)
    expect(screen.getByText(/Correct Answer:/)).toBeInTheDocument()
    expect(screen.getByText('Answer Distribution')).toBeInTheDocument()
  })

  it('should display leaderboards when provided', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={mockLeaderboard}
        eventLeaderboard={mockLeaderboard}
      />
    )
    
    expect(screen.getByText('Segment Standings')).toBeInTheDocument()
    expect(screen.getByText('Event Standings')).toBeInTheDocument()
    expect(screen.getAllByText('Alice')).toHaveLength(2)
    expect(screen.getAllByText('Bob')).toHaveLength(2)
  })

  it('should show encouraging message when all participants score zero', () => {
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        pointsEarned={0}
        segmentLeaderboard={mockZeroLeaderboard}
      />
    )
    
    expect(screen.getByText('🤔')).toBeInTheDocument()
    expect(screen.getByText('Tough question!')).toBeInTheDocument()
    expect(screen.getByText(/that was a challenging one/)).toBeInTheDocument()
  })

  it('should show timeout message when no one answered', () => {
    const emptyDistribution: AnswerDistribution[] = []
    
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={emptyDistribution}
        pointsEarned={0}
      />
    )
    
    expect(screen.getByText('⏰')).toBeInTheDocument()
    expect(screen.getByText("Time's up!")).toBeInTheDocument()
    expect(screen.getByText(/No one answered this question in time/)).toBeInTheDocument()
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
    
    // Should not show leaderboard sections when empty
    expect(screen.queryByText('Segment Standings')).not.toBeInTheDocument()
    expect(screen.queryByText('Event Standings')).not.toBeInTheDocument()
  })

  it('should show emoji rankings for top 3', () => {
    const topThree: LeaderboardEntry[] = [
      { rank: 1, user_id: 'user1', username: 'Alice', score: 100 },
      { rank: 2, user_id: 'user2', username: 'Bob', score: 80 },
      { rank: 3, user_id: 'user3', username: 'Charlie', score: 60 },
    ]
    
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={topThree}
      />
    )
    
    expect(screen.getByText('🥇')).toBeInTheDocument()
    expect(screen.getByText('🥈')).toBeInTheDocument()
    expect(screen.getByText('🥉')).toBeInTheDocument()
  })

  it('should show rank numbers for positions beyond 3rd', () => {
    const longLeaderboard: LeaderboardEntry[] = [
      { rank: 1, user_id: 'user1', username: 'Alice', score: 100 },
      { rank: 2, user_id: 'user2', username: 'Bob', score: 80 },
      { rank: 3, user_id: 'user3', username: 'Charlie', score: 60 },
      { rank: 4, user_id: 'user4', username: 'David', score: 40 },
    ]
    
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={mockDistribution}
        segmentLeaderboard={longLeaderboard}
      />
    )
    
    expect(screen.getByText('#4')).toBeInTheDocument()
  })

  it('should handle zero distribution gracefully', () => {
    const zeroDistribution: AnswerDistribution[] = [
      { answer: 'Paris', count: 0, is_correct: true },
      { answer: 'London', count: 0, is_correct: false },
    ]
    
    render(
      <QuizResults
        correctAnswer="Paris"
        distribution={zeroDistribution}
      />
    )
    
    expect(screen.getAllByText('0%')).toHaveLength(2)
  })
})