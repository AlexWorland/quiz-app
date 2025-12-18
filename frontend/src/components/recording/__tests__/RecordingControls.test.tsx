import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecordingControls } from '../RecordingControls'

describe('RecordingControls', () => {
  const mockOnStart = vi.fn()
  const mockOnPause = vi.fn()
  const mockOnResume = vi.fn()
  const mockOnStop = vi.fn()
  const mockOnRestart = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "Start Recording" button when status is pending', () => {
    render(
      <RecordingControls
        status="pending"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    expect(screen.getByText('Start Recording')).toBeInTheDocument()
  })

  it('should show "Resume" button when status is recording_paused', () => {
    render(
      <RecordingControls
        status="recording_paused"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    expect(screen.getByText('Resume')).toBeInTheDocument()
  })

  it('should show "Pause" and "Stop & Start Quiz" buttons when status is recording', () => {
    render(
      <RecordingControls
        status="recording"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('Stop & Start Quiz')).toBeInTheDocument()
  })

  it('should show "Restart" button when recording', () => {
    render(
      <RecordingControls
        status="recording"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    expect(screen.getByText('Restart')).toBeInTheDocument()
  })

  it('should show "Restart" button when paused', () => {
    render(
      <RecordingControls
        status="recording_paused"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    expect(screen.getByText('Restart')).toBeInTheDocument()
  })

  it('should call onStart when Start button clicked', () => {
    render(
      <RecordingControls
        status="pending"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    fireEvent.click(screen.getByText('Start Recording'))
    expect(mockOnStart).toHaveBeenCalledTimes(1)
  })

  it('should call onPause when Pause button clicked', () => {
    render(
      <RecordingControls
        status="recording"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    fireEvent.click(screen.getByText('Pause'))
    expect(mockOnPause).toHaveBeenCalledTimes(1)
  })

  it('should call onResume when Resume button clicked', () => {
    render(
      <RecordingControls
        status="recording_paused"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    fireEvent.click(screen.getByText('Resume'))
    expect(mockOnResume).toHaveBeenCalledTimes(1)
  })

  it('should call onStop when Stop button clicked', () => {
    render(
      <RecordingControls
        status="recording"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    fireEvent.click(screen.getByText('Stop & Start Quiz'))
    expect(mockOnStop).toHaveBeenCalledTimes(1)
  })

  it('should call onRestart when Restart button clicked', () => {
    render(
      <RecordingControls
        status="recording"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
      />
    )

    fireEvent.click(screen.getByText('Restart'))
    expect(mockOnRestart).toHaveBeenCalledTimes(1)
  })

  it('should disable buttons when disabled prop is true', () => {
    render(
      <RecordingControls
        status="pending"
        onStart={mockOnStart}
        onPause={mockOnPause}
        onResume={mockOnResume}
        onStop={mockOnStop}
        onRestart={mockOnRestart}
        disabled
      />
    )

    const startButton = screen.getByText('Start Recording')
    expect(startButton.closest('button')).toBeDisabled()
  })
})
