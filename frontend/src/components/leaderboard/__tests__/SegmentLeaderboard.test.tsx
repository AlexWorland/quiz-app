import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SegmentLeaderboard } from '../SegmentLeaderboard'

interface LeaderboardEntry {
  user_id: string
  username: string
  score: number
  rank: number
  avatar_url?: string
}

const mockRankings: LeaderboardEntry[] = [
  {
    user_id: '1',
    username: 'Alice',
    score: 100,
    rank: 1,
    avatar_url: 'https://example.com/avatar1.png',
  },
  { user_id: '2', username: 'Bob', score: 80, rank: 2 },
  { user_id: '3', username: 'Charlie', score: 60, rank: 3 },
  { user_id: '4', username: 'Dave', score: 40, rank: 4 },
]

describe('SegmentLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "No scores yet" when rankings array is empty', () => {
    render(<SegmentLeaderboard rankings={[]} />)
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
  })

  it('should display "Segment Leaderboard" title', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('Segment Leaderboard')).toBeInTheDocument()
  })

  it('should render all entries with username and score', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('should show rank icons for top 3', () => {
    const { container } = render(<SegmentLeaderboard rankings={mockRankings} />)
    // Top 3 have SVG icons
    const svgIcons = container.querySelectorAll('svg')
    expect(svgIcons.length).toBeGreaterThanOrEqual(3)
  })

  it('should show rank number for ranks > 3', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('should display avatar image when avatar_url provided', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />)
    const avatar = screen.getByAltText('Alice') as HTMLImageElement
    expect(avatar).toBeInTheDocument()
    expect(avatar.src).toBe('https://example.com/avatar1.png')
  })

  it('should display initial letter when no avatar_url', () => {
    render(<SegmentLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
