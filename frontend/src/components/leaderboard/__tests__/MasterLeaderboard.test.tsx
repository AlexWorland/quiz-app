import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MasterLeaderboard } from '../MasterLeaderboard'
import type { LeaderboardEntry } from '@/api/endpoints'

const mockRankings: LeaderboardEntry[] = [
  {
    rank: 1,
    user_id: 'user1',
    username: 'Alice',
    avatar_url: 'https://example.com/alice.jpg',
    score: 100,
    is_late_joiner: false,
    response_time_ms: 1500,
  },
  {
    rank: 2,
    user_id: 'user2',
    username: 'Bob',
    avatar_url: undefined,
    score: 80,
    is_late_joiner: true,
    response_time_ms: 2000,
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
]

describe('MasterLeaderboard', () => {
  it('should render leaderboard title and tie-breaker info', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    
    expect(screen.getByText('🏆 Master Leaderboard')).toBeInTheDocument()
    expect(screen.getByText('Aggregate scores across all segments')).toBeInTheDocument()
    expect(screen.getByText(/Tie-breaker:/)).toBeInTheDocument()
    expect(screen.getByText(/faster cumulative time wins/)).toBeInTheDocument()
  })

  it('should display normal rankings with scores', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByTestId('trophy-icon')).toBeInTheDocument()
    expect(screen.getByTestId('medal-icon')).toBeInTheDocument()
  })

  it('should show late joiner badge', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    
    expect(screen.getByText('Late')).toBeInTheDocument()
  })

  it('should display empty state when no participants', () => {
    render(<MasterLeaderboard rankings={[]} />)
    
    expect(screen.getByText('🎯')).toBeInTheDocument()
    expect(screen.getByText('No participants yet')).toBeInTheDocument()
    expect(screen.getByText('Participants will appear here once they join')).toBeInTheDocument()
  })

  it('should display encouraging message for all-zero scores', () => {
    render(<MasterLeaderboard rankings={mockZeroRankings} />)
    
    expect(screen.getByText('🤝')).toBeInTheDocument()
    expect(screen.getByText("Everyone's learning together!")).toBeInTheDocument()
    expect(screen.getByText('No points scored yet, but that\'s part of the journey')).toBeInTheDocument()
  })

  it('should show participants with zero scores in encouraging format', () => {
    render(<MasterLeaderboard rankings={mockZeroRankings} />)
    
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getAllByText('0 points')).toHaveLength(2)
    
    // Should still show late joiner badge with reduced opacity
    expect(screen.getByText('Late')).toBeInTheDocument()
  })

  it('should display tie tooltips for tied participants', () => {
    const tiedRankings: LeaderboardEntry[] = [
      {
        rank: 1,
        user_id: 'user1',
        username: 'Alice',
        score: 100,
        is_late_joiner: false,
        response_time_ms: 1500,
      },
      {
        rank: 2,
        user_id: 'user2',
        username: 'Bob',
        score: 100,
        is_late_joiner: false,
        response_time_ms: 2000,
      },
    ]

    render(<MasterLeaderboard rankings={tiedRankings} />)
    
    expect(screen.getByTestId('tie-tooltip-user2')).toBeInTheDocument()
  })

  it('should support segments played information', () => {
    const segmentsPlayed = { user1: 3, user2: 2 }
    render(<MasterLeaderboard rankings={mockRankings} segmentsPlayed={segmentsPlayed} />)
    
    expect(screen.getByText('3 segments played')).toBeInTheDocument()
    expect(screen.getByText('2 segments played')).toBeInTheDocument()
  })

  it('should handle missing avatar URLs', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    
    // Alice has avatar URL, Bob doesn't
    expect(screen.getByAltText('Alice')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument() // Fallback initial
  })

  it('should disable tie tooltips when showTieTooltip is false', () => {
    const tiedRankings: LeaderboardEntry[] = [
      {
        rank: 1,
        user_id: 'user1',
        username: 'Alice',
        score: 100,
        is_late_joiner: false,
        response_time_ms: 1500,
      },
      {
        rank: 2,
        user_id: 'user2',
        username: 'Bob',
        score: 100,
        is_late_joiner: false,
        response_time_ms: 2000,
      },
    ]

    render(<MasterLeaderboard rankings={tiedRankings} showTieTooltip={false} />)
    
    expect(screen.queryByTestId('tie-tooltip-user2')).not.toBeInTheDocument()
  })
})