import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MasterLeaderboard } from '../MasterLeaderboard'

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

const mockSegmentsPlayed: Record<string, number> = {
  '1': 5,
  '2': 4,
  '3': 3,
  '4': 2,
}

describe('MasterLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "No scores yet" when rankings array is empty', () => {
    render(<MasterLeaderboard rankings={[]} />)
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
  })

  it('should display "Master Leaderboard" title with trophy emoji', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    expect(screen.getByText(/Master Leaderboard/)).toBeInTheDocument()
  })

  it('should render all entries with username and score', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('should show rank icons for top 3 and number for rank 4', () => {
    const { container } = render(<MasterLeaderboard rankings={mockRankings} />)
    // Top 3 have SVG icons, rank 4 shows number
    const svgIcons = container.querySelectorAll('svg')
    expect(svgIcons.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('should show "total points" label for each score', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    const labels = screen.getAllByText(/total points/)
    expect(labels.length).toBeGreaterThan(0)
  })

  it('should display segments played count when segmentsPlayed provided', () => {
    render(
      <MasterLeaderboard
        rankings={mockRankings}
        segmentsPlayed={mockSegmentsPlayed}
      />
    )
    expect(screen.getByText(/5 segments played/)).toBeInTheDocument()
    expect(screen.getByText(/4 segments played/)).toBeInTheDocument()
    expect(screen.getByText(/3 segments played/)).toBeInTheDocument()
  })

  it('should display avatar image when avatar_url provided', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    const avatar = screen.getByAltText('Alice') as HTMLImageElement
    expect(avatar).toBeInTheDocument()
    expect(avatar.src).toBe('https://example.com/avatar1.png')
  })

  it('should display initial letter when no avatar_url', () => {
    render(<MasterLeaderboard rankings={mockRankings} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('C')).toBeInTheDocument()
  })
})
