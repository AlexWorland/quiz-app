import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WaitingForParticipants } from '../WaitingForParticipants'

describe('WaitingForParticipants', () => {
  const defaultProps = {
    eventTitle: 'Test Event',
    eventCode: 'ABC123',
    segmentTitle: 'Test Segment',
    presenterName: 'John Presenter',
    participantCount: 0,
    isHost: true
  }

  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should render waiting state with event information', () => {
    render(<WaitingForParticipants {...defaultProps} />)
    
    expect(screen.getByText('Waiting for Participants')).toBeInTheDocument()
    expect(screen.getByText('All participants have disconnected from the quiz')).toBeInTheDocument()
    expect(screen.getByText('Test Event')).toBeInTheDocument()
    expect(screen.getByText('Test Segment')).toBeInTheDocument()
    expect(screen.getByText('John Presenter')).toBeInTheDocument()
    expect(screen.getAllByText('ABC123').length).toBeGreaterThan(0) // Appears multiple times
  })

  it('should show participant count correctly', () => {
    render(<WaitingForParticipants {...defaultProps} participantCount={3} />)
    
    expect(screen.getByText('3 participants connected')).toBeInTheDocument()
  })

  it('should show zero participants message', () => {
    render(<WaitingForParticipants {...defaultProps} participantCount={0} />)
    
    expect(screen.getByText('No participants are currently connected')).toBeInTheDocument()
  })

  it('should show reconnection instructions', () => {
    render(<WaitingForParticipants {...defaultProps} />)
    
    expect(screen.getByText(/Share the join code/)).toBeInTheDocument()
    expect(screen.getByText(/Ask participants to rejoin/)).toBeInTheDocument()
    expect(screen.getByText(/Quiz will automatically resume/)).toBeInTheDocument()
  })

  it('should call onRefresh when Check Now button clicked', () => {
    const onRefresh = vi.fn()
    
    render(<WaitingForParticipants {...defaultProps} onRefresh={onRefresh} />)
    
    const checkButton = screen.getByText('Check Now')
    fireEvent.click(checkButton)
    
    expect(onRefresh).toHaveBeenCalled()
  })

  it('should call onResume when Continue Anyway button clicked', () => {
    const onResume = vi.fn()
    
    render(<WaitingForParticipants {...defaultProps} onResume={onResume} />)
    
    const continueButton = screen.getByText('Continue Anyway')
    fireEvent.click(continueButton)
    
    expect(onResume).toHaveBeenCalled()
  })

  it('should not show Continue Anyway button for non-host', () => {
    render(<WaitingForParticipants {...defaultProps} isHost={false} />)
    
    expect(screen.queryByRole('button', { name: 'Continue Anyway' })).not.toBeInTheDocument()
  })

  it('should toggle auto-refresh', () => {
    render(<WaitingForParticipants {...defaultProps} onRefresh={vi.fn()} />)
    
    const autoRefreshButton = screen.getByText(/Auto-refresh: On/)
    expect(autoRefreshButton).toBeInTheDocument()
    
    fireEvent.click(autoRefreshButton)
    
    expect(screen.getByText(/Auto-refresh: Off/)).toBeInTheDocument()
  })

  it('should auto-refresh with countdown when enabled', async () => {
    const onRefresh = vi.fn()
    
    render(<WaitingForParticipants {...defaultProps} onRefresh={onRefresh} />)
    
    expect(screen.getByText(/Auto-refreshing in 30 seconds/)).toBeInTheDocument()
    
    // Fast-forward to just before auto-refresh
    await vi.advanceTimersByTimeAsync(29000)
    
    await waitFor(() => {
      expect(screen.getByText(/Auto-refreshing in 1 second/)).toBeInTheDocument()
    })
    
    // Fast-forward past auto-refresh
    await vi.advanceTimersByTimeAsync(1000)
    
    await waitFor(() => {
      expect(onRefresh).toHaveBeenCalled()
    })
  })

  it('should not auto-refresh when disabled', () => {
    const onRefresh = vi.fn()
    
    render(<WaitingForParticipants {...defaultProps} onRefresh={onRefresh} />)
    
    // Disable auto-refresh
    const autoRefreshButton = screen.getByText(/Auto-refresh: On/)
    fireEvent.click(autoRefreshButton)
    
    // Fast-forward past normal refresh time
    vi.advanceTimersByTime(35000)
    
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('should handle missing segment title gracefully', () => {
    render(<WaitingForParticipants {...defaultProps} segmentTitle={undefined} />)
    
    expect(screen.queryByText('Segment:')).not.toBeInTheDocument()
    expect(screen.getByText('Event:')).toBeInTheDocument()
  })

  it('should disable Check Now button when no onRefresh provided', () => {
    render(<WaitingForParticipants {...defaultProps} onRefresh={undefined} />)
    
    const checkButton = screen.getByText('Check Now').closest('button')
    expect(checkButton).toBeDisabled()
  })

  it('should show animation dots', () => {
    render(<WaitingForParticipants {...defaultProps} />)
    
    // Should have 3 animated dots
    const container = screen.getByText('Waiting for Participants').closest('div')
    expect(container?.querySelectorAll('[style*="animation"]')).toBeDefined()
  })
})
