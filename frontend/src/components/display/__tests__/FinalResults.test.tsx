import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinalResults } from '../FinalResults'
import type { LeaderboardEntry } from '@/api/endpoints'

const mockRankings: LeaderboardEntry[] = [
  {
    rank: 1,
    user_id: 'user1',
    username: 'Alice',
    avatar_url: 'https://example.com/alice.jpg',
    score: 150,
    is_late_joiner: false,
    response_time_ms: 1500,
  },
  {
    rank: 2,
    user_id: 'user2',
    username: 'Bob',
    score: 120,
    is_late_joiner: true,
    response_time_ms: 2000,
  },
  {
    rank: 3,
    user_id: 'user3',
    username: 'Charlie',
    score: 100,
    is_late_joiner: false,
    response_time_ms: 1800,
  },
]

const mockZeroRankings: LeaderboardEntry[] = [
  {
    rank: 1,
    user_id: 'user1',
    username: 'Alice',
    score: 0,
    is_late_joiner: false,
    response_time_ms: 1500,
  },
  {
    rank: 2,
    user_id: 'user2',
    username: 'Bob',
    score: 0,
    is_late_joiner: true,
    response_time_ms: 2000,
  },
  {
    rank: 3,
    user_id: 'user3',
    username: 'Charlie',
    score: 0,
    is_late_joiner: false,
    response_time_ms: 1800,
  },
]

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}))

describe('FinalResults', () => {
  it('should render event title when provided', () => {
    render(
      <FinalResults
        rankings={mockRankings}
        totalQuestions={10}
        eventTitle="Quiz Championship 2024"
      />
    )
    
    expect(screen.getByText('Quiz Championship 2024')).toBeInTheDocument()
  })

  it('should display winner celebration for normal scores', () => {
    render(
      <FinalResults
        rankings={mockRankings}
        totalQuestions={10}
      />
    )
    
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('Winner!')).toBeInTheDocument()
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getByText('150 points')).toBeInTheDocument()
  })

  it('should show participation awards for all-zero scores', () => {
    render(
      <FinalResults
        rankings={mockZeroRankings}
        totalQuestions={10}
      />
    )
    
    expect(screen.getByText('🎊')).toBeInTheDocument()
    expect(screen.getByText("Everyone's a Participant!")).toBeInTheDocument()
    expect(screen.getByText(/Learning is the real victory/)).toBeInTheDocument()
    expect(screen.getByText(/Thanks for participating/)).toBeInTheDocument()
  })

  it('should display participation awards grid for zero scores', () => {
    render(
      <FinalResults
        rankings={mockZeroRankings}
        totalQuestions={10}
      />
    )
    
    // Should show all participants as award recipients
    expect(screen.getAllByText('🏅')).toHaveLength(3)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getAllByText('Participant')).toHaveLength(3)
  })

  it('should show late joiner badge in participation awards', () => {
    render(
      <FinalResults
        rankings={mockZeroRankings}
        totalQuestions={10}
      />
    )
    
    expect(screen.getByText('Late Join')).toBeInTheDocument()
  })

  it('should display top 3 podium for normal scores', () => {
    render(
      <FinalResults
        rankings={mockRankings}
        totalQuestions={10}
      />
    )
    
    expect(screen.getByText('Top 3')).toBeInTheDocument()
    expect(screen.getAllByText('Alice')).toHaveLength(2) // Winner + podium
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('should display full leaderboard for rankings beyond top 3', () => {
    const longRankings = [
      ...mockRankings,
      { rank: 4, user_id: 'user4', username: 'David', score: 80, is_late_joiner: false, response_time_ms: 2500 },
      { rank: 5, user_id: 'user5', username: 'Eve', score: 60, is_late_joiner: false, response_time_ms: 3000 },
    ]

    render(
      <FinalResults
        rankings={longRankings}
        totalQuestions={10}
      />
    )
    
    expect(screen.getByText('Full Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('David')).toBeInTheDocument()
    expect(screen.getByText('Eve')).toBeInTheDocument()
  })

  it('should show question count summary', () => {
    render(
      <FinalResults
        rankings={mockRankings}
        totalQuestions={15}
      />
    )
    
    expect(screen.getByText('Completed 15 questions')).toBeInTheDocument()
  })

  it('should handle empty rankings gracefully', () => {
    render(
      <FinalResults
        rankings={[]}
        totalQuestions={5}
      />
    )
    
    // Should not crash and should show completed questions
    expect(screen.getByText('Completed 5 questions')).toBeInTheDocument()
  })

  it('should handle avatar fallbacks in participation awards', () => {
    const rankingsWithoutAvatars = mockZeroRankings.map(r => ({ ...r, avatar_url: undefined }))
    
    render(
      <FinalResults
        rankings={rankingsWithoutAvatars}
        totalQuestions={10}
      />
    )
    
    // Should show initials for users without avatars
    expect(screen.getByText('A')).toBeInTheDocument() // Alice
    expect(screen.getByText('B')).toBeInTheDocument() // Bob
    expect(screen.getByText('C')).toBeInTheDocument() // Charlie
  })

  it('should limit participation awards to 8 participants with overflow message', () => {
    const manyZeroRankings: LeaderboardEntry[] = Array.from({ length: 12 }, (_, i) => ({
      rank: i + 1,
      user_id: `user${i + 1}`,
      username: `User${i + 1}`,
      score: 0,
      is_late_joiner: false,
      response_time_ms: 1000,
    }))

    render(
      <FinalResults
        rankings={manyZeroRankings}
        totalQuestions={10}
      />
    )
    
    // Should show only 8 awards
    expect(screen.getAllByText('🏅')).toHaveLength(8)
    // Should show overflow message
    expect(screen.getByText('+ 4 more participants')).toBeInTheDocument()
  })

  it('should show tie-break tooltips in winner section for tied scores', () => {
    const tiedRankings: LeaderboardEntry[] = [
      {
        rank: 1,
        user_id: 'user1',
        username: 'Alice',
        score: 100,
        is_late_joiner: false,
        response_time_ms: 1500,
      },
    ]

    render(
      <FinalResults
        rankings={tiedRankings}
        totalQuestions={10}
      />
    )
    
    // Winner section should exist
    expect(screen.getByText('Winner!')).toBeInTheDocument()
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
  })

  it('should not show participation awards for mixed scores', () => {
    const mixedRankings: LeaderboardEntry[] = [
      { rank: 1, user_id: 'user1', username: 'Alice', score: 100, is_late_joiner: false, response_time_ms: 1500 },
      { rank: 2, user_id: 'user2', username: 'Bob', score: 0, is_late_joiner: false, response_time_ms: 2000 },
    ]

    render(
      <FinalResults
        rankings={mixedRankings}
        totalQuestions={10}
      />
    )
    
    // Should show winner celebration, not participation awards
    expect(screen.getByText('🏆')).toBeInTheDocument()
    expect(screen.getByText('Winner!')).toBeInTheDocument()
    expect(screen.queryByText("Everyone's a Participant!")).not.toBeInTheDocument()
  })
})