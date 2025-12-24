import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SingleSegmentReview } from '../SingleSegmentReview'
import type { LeaderboardEntry } from '@/api/endpoints'

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, user_id: 'user1', username: 'Alice', score: 100, is_late_joiner: false },
  { rank: 2, user_id: 'user2', username: 'Bob', score: 80, is_late_joiner: true },
  { rank: 3, user_id: 'user3', username: 'Charlie', score: 60, is_late_joiner: false },
]

const defaultProps = {
  eventId: 'event-123',
  eventTitle: 'Single Segment Event',
  segmentTitle: 'Main Presentation',
  availableQuestions: 8,
  currentLeaderboard: mockLeaderboard,
  onStartReview: vi.fn(),
  onSkipToResults: vi.fn(),
  isHost: true
}

describe('SingleSegmentReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should render single segment review header', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText('Ready for Final Review')).toBeInTheDocument()
    expect(screen.getByText('Single presenter event completed!')).toBeInTheDocument()
    expect(screen.getByText(/Main Presentation.*has ended/)).toBeInTheDocument()
  })

  it('should display event summary', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText('Single Segment Event')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument() // Available questions
    expect(screen.getByText('3')).toBeInTheDocument() // Participants
  })

  it('should show current standings preview', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText('Current Standings')).toBeInTheDocument()
    expect(screen.getByText('🥇')).toBeInTheDocument()
    expect(screen.getByText('🥈')).toBeInTheDocument()
    expect(screen.getByText('🥉')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('should show question count selection for host', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText('Review Questions')).toBeInTheDocument()
    expect(screen.getByText('3 Questions')).toBeInTheDocument()
    expect(screen.getByText('5 Questions')).toBeInTheDocument()
    expect(screen.getByText('All Questions')).toBeInTheDocument()
  })

  it('should allow selecting question count', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    const allQuestionsButton = screen.getByText('All Questions')
    fireEvent.click(allQuestionsButton)
    
    // Should be selected (visual feedback through CSS classes)
    expect(allQuestionsButton).toHaveClass('border-purple-500')
  })

  it('should call onStartReview when start button clicked', () => {
    const onStartReview = vi.fn()
    
    render(<SingleSegmentReview {...defaultProps} onStartReview={onStartReview} />)
    
    const startButton = screen.getByText(/Start Review/)
    fireEvent.click(startButton)
    
    expect(onStartReview).toHaveBeenCalledWith(5) // Default selection
  })

  it('should call onSkipToResults when skip button clicked', () => {
    const onSkipToResults = vi.fn()
    
    render(<SingleSegmentReview {...defaultProps} onSkipToResults={onSkipToResults} />)
    
    const skipButton = screen.getByText(/Skip to Final Results/)
    fireEvent.click(skipButton)
    
    expect(onSkipToResults).toHaveBeenCalled()
  })

  it('should auto-start with countdown for host', () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText(/Start Review \(10s\)/)).toBeInTheDocument()
    expect(screen.getByText(/Review will start automatically in 10 seconds/)).toBeInTheDocument()
  })

  it('should update countdown timer', async () => {
    render(<SingleSegmentReview {...defaultProps} />)
    
    expect(screen.getByText(/Start Review \(10s\)/)).toBeInTheDocument()
    
    // Advance timer
    await vi.advanceTimersByTimeAsync(3000)
    
    await waitFor(() => {
      expect(screen.getByText(/Start Review \(7s\)/)).toBeInTheDocument()
    })
  })

  it('should auto-start after countdown expires', async () => {
    const onStartReview = vi.fn()
    
    render(<SingleSegmentReview {...defaultProps} onStartReview={onStartReview} />)
    
    // Fast-forward past countdown
    await vi.advanceTimersByTimeAsync(10000)
    
    await waitFor(() => {
      expect(onStartReview).toHaveBeenCalledWith(5) // Default question count
    })
  })

  it('should cancel auto-start when cancel button clicked', () => {
    const onStartReview = vi.fn()
    
    render(<SingleSegmentReview {...defaultProps} onStartReview={onStartReview} />)
    
    const cancelButton = screen.getByText('Cancel Auto-start')
    fireEvent.click(cancelButton)
    
    expect(screen.getByText('Start Review Quiz')).toBeInTheDocument() // No countdown
    
    // Fast-forward - should not auto-start
    vi.advanceTimersByTime(15000)
    expect(onStartReview).not.toHaveBeenCalled()
  })

  it('should show waiting message for non-host', () => {
    render(<SingleSegmentReview {...defaultProps} isHost={false} />)
    
    expect(screen.getByText('Waiting for host to start the final review...')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start Review/ })).not.toBeInTheDocument()
  })

  it('should handle zero questions gracefully', () => {
    render(<SingleSegmentReview {...defaultProps} availableQuestions={0} />)
    
    expect(screen.getByText(/No questions are available for review.*Proceeding directly to final results/)).toBeInTheDocument()
    expect(screen.getByText(/Start Review/).closest('button')).toBeDisabled()
  })

  it('should handle large leaderboard', () => {
    const longLeaderboard = Array.from({ length: 5 }, (_, i) => ({
      rank: i + 1,
      user_id: `user${i + 1}`,
      username: `User${i + 1}`,
      score: 100 - i * 10,
      is_late_joiner: false
    }))

    render(<SingleSegmentReview {...defaultProps} currentLeaderboard={longLeaderboard} />)
    
    expect(screen.getByText('+ 2 more participants')).toBeInTheDocument()
  })

  it('should handle missing segment title', () => {
    render(<SingleSegmentReview {...defaultProps} segmentTitle={undefined} />)
    
    expect(screen.getByText(/The presentation.*has ended/)).toBeInTheDocument()
  })

  it('should limit question count options based on available questions', () => {
    render(<SingleSegmentReview {...defaultProps} availableQuestions={4} />)
    
    expect(screen.getByText('3 Questions')).toBeInTheDocument()
    expect(screen.getByText('All Questions')).toBeInTheDocument() // Should be 4
    expect(screen.queryByText('5 Questions')).not.toBeInTheDocument() // Not available
    expect(screen.queryByText('10 Questions')).not.toBeInTheDocument() // Not available
  })

  it('should start with appropriate default question count', async () => {
    const onStartReview = vi.fn()
    
    // Test with many questions available
    render(<SingleSegmentReview {...defaultProps} onStartReview={onStartReview} availableQuestions={15} />)
    
    await vi.advanceTimersByTimeAsync(10000) // Auto-start
    
    await waitFor(() => {
      expect(onStartReview).toHaveBeenCalledWith(5) // Default to 5
    })
  })

  it('should start with all questions when fewer than default available', async () => {
    const onStartReview = vi.fn()
    
    render(<SingleSegmentReview {...defaultProps} onStartReview={onStartReview} availableQuestions={3} />)
    
    await vi.advanceTimersByTimeAsync(10000) // Auto-start
    
    await waitFor(() => {
      expect(onStartReview).toHaveBeenCalledWith(3) // All available
    })
  })
})
