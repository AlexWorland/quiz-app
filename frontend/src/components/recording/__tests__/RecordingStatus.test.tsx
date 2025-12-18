import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecordingStatus } from '../RecordingStatus'

describe('RecordingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should show "NOT STARTED" when status is pending', () => {
    render(<RecordingStatus status="pending" />)
    expect(screen.getByText('NOT STARTED')).toBeInTheDocument()
  })

  it('should show "LIVE" when status is recording', () => {
    render(<RecordingStatus status="recording" />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('should show "PAUSED" when status is recording_paused', () => {
    render(<RecordingStatus status="recording_paused" />)
    expect(screen.getByText('PAUSED')).toBeInTheDocument()
  })

  it('should show "READY FOR QUIZ" when status is quiz_ready', () => {
    render(<RecordingStatus status="quiz_ready" />)
    expect(screen.getByText('READY FOR QUIZ')).toBeInTheDocument()
  })

  it('should show "QUIZ IN PROGRESS" when status is quizzing', () => {
    render(<RecordingStatus status="quizzing" />)
    expect(screen.getByText('QUIZ IN PROGRESS')).toBeInTheDocument()
  })

  it('should show "COMPLETED" when status is completed', () => {
    render(<RecordingStatus status="completed" />)
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })

  it('should display elapsed time when recording', async () => {
    const now = new Date('2024-01-01T12:00:00').getTime()
    vi.setSystemTime(now)

    const startedAt = new Date(now - 125000).toISOString() // 125 seconds ago
    render(<RecordingStatus status="recording" startedAt={startedAt} />)

    // Timer updates every second
    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByText('02:06')).toBeInTheDocument()
  })

  it('should have text-red-500 color when status is recording', () => {
    render(<RecordingStatus status="recording" />)
    const statusText = screen.getByText('LIVE')
    expect(statusText).toHaveClass('text-red-500')
  })

  it('should have text-yellow-500 color when status is recording_paused', () => {
    render(<RecordingStatus status="recording_paused" />)
    const statusText = screen.getByText('PAUSED')
    expect(statusText).toHaveClass('text-yellow-500')
  })

  it('should have text-green-500 color when status is quiz_ready', () => {
    render(<RecordingStatus status="quiz_ready" />)
    const statusText = screen.getByText('READY FOR QUIZ')
    expect(statusText).toHaveClass('text-green-500')
  })

  it('should have text-gray-400 color for other statuses', () => {
    render(<RecordingStatus status="pending" />)
    const statusText = screen.getByText('NOT STARTED')
    expect(statusText).toHaveClass('text-gray-400')
  })

  it('should show pulse animation icon when recording', () => {
    const { container } = render(<RecordingStatus status="recording" />)
    const pulseIcon = container.querySelector('.animate-pulse')
    expect(pulseIcon).toBeInTheDocument()
  })

  it('should not show time when not recording', () => {
    render(<RecordingStatus status="pending" />)
    expect(screen.queryByText(/\d{2}:\d{2}/)).not.toBeInTheDocument()
  })
})
