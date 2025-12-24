import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResumeControls } from '../ResumeControls'

describe('ResumeControls', () => {
  const mockOnResume = vi.fn()
  const mockOnClearResume = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when no previous status', () => {
    const { container } = render(
      <ResumeControls
        type="segment"
        previousStatus={null}
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render for segment with previous status', () => {
    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    expect(screen.getByText('Segment Ended Accidentally?')).toBeInTheDocument()
    expect(screen.getByText(/This segment was recently ended/i)).toBeInTheDocument()
  })

  it('should render for event with previous status', () => {
    render(
      <ResumeControls
        type="event"
        previousStatus="active"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    expect(screen.getByText('Event Ended Accidentally?')).toBeInTheDocument()
    expect(screen.getByText(/This event was recently ended/i)).toBeInTheDocument()
  })

  it('should show resume and clear buttons', () => {
    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Clear & Continue/i })).toBeInTheDocument()
  })

  it('should call onResume when resume button clicked', async () => {
    const user = userEvent.setup()
    mockOnResume.mockResolvedValue(undefined)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(mockOnResume).toHaveBeenCalledTimes(1)
    })
  })

  it('should call onClearResume when clear button clicked', async () => {
    const user = userEvent.setup()
    mockOnClearResume.mockResolvedValue(undefined)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(mockOnClearResume).toHaveBeenCalledTimes(1)
    })
  })

  it('should show loading state while resuming', async () => {
    const user = userEvent.setup()
    let resolveResume: () => void
    const resumePromise = new Promise<void>((resolve) => {
      resolveResume = resolve
    })
    mockOnResume.mockReturnValue(resumePromise)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(screen.getByText('Resuming...')).toBeInTheDocument()
    })

    resolveResume!()

    await waitFor(() => {
      expect(screen.queryByText('Resuming...')).not.toBeInTheDocument()
    })
  })

  it('should show loading state while clearing', async () => {
    const user = userEvent.setup()
    let resolveClear: () => void
    const clearPromise = new Promise<void>((resolve) => {
      resolveClear = resolve
    })
    mockOnClearResume.mockReturnValue(clearPromise)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(screen.getByText('Clearing...')).toBeInTheDocument()
    })

    resolveClear!()

    await waitFor(() => {
      expect(screen.queryByText('Clearing...')).not.toBeInTheDocument()
    })
  })

  it('should show error when resume fails', async () => {
    const user = userEvent.setup()
    mockOnResume.mockRejectedValue(new Error('Network error'))

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    await user.click(resumeButton)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('should show error when clear fails', async () => {
    const user = userEvent.setup()
    mockOnClearResume.mockRejectedValue(new Error('Server error'))

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('should disable buttons when disabled prop is true', () => {
    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
        disabled={true}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })

    expect(resumeButton).toBeDisabled()
    expect(clearButton).toBeDisabled()
  })

  it('should disable both buttons while one is loading', async () => {
    const user = userEvent.setup()
    let resolveResume: () => void
    const resumePromise = new Promise<void>((resolve) => {
      resolveResume = resolve
    })
    mockOnResume.mockReturnValue(resumePromise)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })
    const clearButton = screen.getByRole('button', { name: /Clear & Continue/i })

    await user.click(resumeButton)

    await waitFor(() => {
      expect(resumeButton).toBeDisabled()
      expect(clearButton).toBeDisabled()
    })

    resolveResume!()
  })

  it('should show alert icon', () => {
    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument()
  })

  it('should clear error when retrying after failure', async () => {
    const user = userEvent.setup()
    mockOnResume
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(undefined)

    render(
      <ResumeControls
        type="segment"
        previousStatus="quizzing"
        onResume={mockOnResume}
        onClearResume={mockOnClearResume}
      />
    )

    const resumeButton = screen.getByRole('button', { name: /Resume/i })

    // First attempt fails
    await user.click(resumeButton)
    await waitFor(() => {
      expect(screen.getByText('First error')).toBeInTheDocument()
    })

    // Second attempt succeeds
    await user.click(resumeButton)
    await waitFor(() => {
      expect(screen.queryByText('First error')).not.toBeInTheDocument()
    })
  })
})
