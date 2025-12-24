import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExtendedLockReminder } from '../ExtendedLockReminder'

describe('ExtendedLockReminder', () => {
  const defaultProps = {
    eventId: 'event-123',
    lockedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
    onUnlock: vi.fn(),
    onDismiss: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should not render when locked for less than 5 minutes', () => {
    const recentLock = new Date(Date.now() - 3 * 60 * 1000) // 3 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={recentLock}
      />
    )
    
    expect(screen.queryByText(/Reminder:/)).not.toBeInTheDocument()
  })

  it('should render medium priority reminder for 5-9 minutes', () => {
    const lockTime = new Date(Date.now() - 6 * 60 * 1000) // 6 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText('💡')).toBeInTheDocument()
    expect(screen.getByText('Reminder: Joining Locked')).toBeInTheDocument()
    expect(screen.getByText(/6 minutes/)).toBeInTheDocument()
  })

  it('should render high priority reminder for 10-14 minutes', () => {
    const lockTime = new Date(Date.now() - 12 * 60 * 1000) // 12 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText('⚠️')).toBeInTheDocument()
    expect(screen.getByText('High Priority: Extended Lock')).toBeInTheDocument()
    expect(screen.getByText(/12 minutes/)).toBeInTheDocument()
  })

  it('should render critical priority reminder for 15+ minutes', () => {
    const lockTime = new Date(Date.now() - 18 * 60 * 1000) // 18 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText('🚨')).toBeInTheDocument()
    expect(screen.getByText('Critical: Joining Locked Too Long')).toBeInTheDocument()
    expect(screen.getByText(/18 minutes/)).toBeInTheDocument()
  })

  it('should call onUnlock when unlock button clicked', () => {
    const onUnlock = vi.fn()
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        onUnlock={onUnlock}
      />
    )
    
    const unlockButton = screen.getByRole('button', { name: /Unlock Now/ })
    fireEvent.click(unlockButton)
    
    expect(onUnlock).toHaveBeenCalled()
  })

  it('should call onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        onDismiss={onDismiss}
      />
    )
    
    const dismissButton = screen.getByTitle('Dismiss for 5 minutes')
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalled()
  })

  it('should show lock time in reminder', () => {
    const lockTime = new Date('2024-01-01T10:30:00')
    vi.setSystemTime(new Date('2024-01-01T10:36:00')) // 6 minutes later
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText(/Locked at 10:30/)).toBeInTheDocument()
  })

  it('should update duration every minute', async () => {
    const lockTime = new Date(Date.now() - 6 * 60 * 1000)
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText(/6 minutes/)).toBeInTheDocument()
    
    // Advance time by 1 minute
    await vi.advanceTimersByTimeAsync(60 * 1000)
    
    await waitFor(() => {
      expect(screen.getByText(/7 minutes/)).toBeInTheDocument()
    })
  })

  it('should reappear after dismissal when reaching next 5-minute interval', () => {
    const lockTime = new Date(Date.now() - 9 * 60 * 1000) // 9 minutes ago
    
    const { rerender } = render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    // Dismiss the reminder
    const dismissButton = screen.getByTitle('Dismiss for 5 minutes')
    fireEvent.click(dismissButton)
    
    // Should be dismissed
    expect(screen.queryByText('Reminder: Joining Locked')).not.toBeInTheDocument()
    
    // Rerender with new lock duration (10 minutes - next interval)
    rerender(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={new Date(Date.now() - 10 * 60 * 1000)}
      />
    )
    
    // Should reappear at the 10-minute mark
    expect(screen.getByText('High Priority: Extended Lock')).toBeInTheDocument()
  })

  it('should show loading state during unlock', async () => {
    const onUnlock = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        onUnlock={onUnlock}
      />
    )
    
    const unlockButton = screen.getByRole('button', { name: /Unlock Now/ })
    fireEvent.click(unlockButton)
    
    await waitFor(() => {
      expect(screen.getByText('Unlocking...')).toBeInTheDocument()
    })
    expect(unlockButton).toBeDisabled()
  })

  it('should handle different urgency levels with appropriate styling', () => {
    const criticalLockTime = new Date(Date.now() - 20 * 60 * 1000) // 20 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={criticalLockTime}
      />
    )
    
    expect(screen.getByText('🚨')).toBeInTheDocument()
    expect(screen.getByText(/Late participants are being turned away/)).toBeInTheDocument()
  })

  it('should handle edge case of exactly 5 minutes', () => {
    const lockTime = new Date(Date.now() - 5 * 60 * 1000) // Exactly 5 minutes ago
    
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        lockedAt={lockTime}
      />
    )
    
    expect(screen.getByText('💡')).toBeInTheDocument()
    expect(screen.getByText('Reminder: Joining Locked')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(
      <ExtendedLockReminder 
        {...defaultProps} 
        className="custom-reminder-class"
      />
    )
    
    // Find element with the custom class
    const reminder = screen.getByText('Reminder: Joining Locked').closest('.custom-reminder-class')
    expect(reminder).toBeInTheDocument()
  })
})
