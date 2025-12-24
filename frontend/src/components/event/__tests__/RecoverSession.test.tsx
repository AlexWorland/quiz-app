import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecoverSession } from '../RecoverSession'

describe('RecoverSession', () => {
  const mockOnRecover = vi.fn()
  const mockOnClose = vi.fn()
  const eventCode = 'ABC123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render recovery modal', () => {
    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByRole('heading', { name: /Recover Session/i })).toBeInTheDocument()
    expect(screen.getByText(/If you lost your session/i)).toBeInTheDocument()
    expect(screen.getByText(eventCode)).toBeInTheDocument()
  })

  it('should show event code in readonly field', () => {
    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText(eventCode)).toBeInTheDocument()
  })

  it('should require display name', async () => {
    const user = userEvent.setup()

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })

    // Button should be disabled when name is empty
    expect(submitButton).toBeDisabled()

    // Type a name
    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, 'TestUser')

    // Button should now be enabled
    expect(submitButton).toBeEnabled()
  })

  it('should call onRecover with display name', async () => {
    const user = userEvent.setup()
    mockOnRecover.mockResolvedValue(undefined)

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, 'TestUser')

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnRecover).toHaveBeenCalledWith('TestUser')
    })
  })

  it('should show error when participant not found', async () => {
    const user = userEvent.setup()
    mockOnRecover.mockRejectedValue(new Error('404 Not found'))

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, 'NonExistentUser')

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/No participant found with that name/i)).toBeInTheDocument()
    })

    expect(mockOnRecover).toHaveBeenCalled()
  })

  it('should show generic error for other failures', async () => {
    const user = userEvent.setup()
    mockOnRecover.mockRejectedValue(new Error('Network error'))

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, 'TestUser')

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('should call onClose when cancel is clicked', async () => {
    const user = userEvent.setup()

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
    expect(mockOnRecover).not.toHaveBeenCalled()
  })

  it('should call onClose when X button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByLabelText('Close')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should trim whitespace from display name', async () => {
    const user = userEvent.setup()
    mockOnRecover.mockResolvedValue(undefined)

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, '  TestUser  ')

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnRecover).toHaveBeenCalledWith('TestUser')
    })
  })

  it('should disable submit during recovery', async () => {
    const user = userEvent.setup()
    let resolveRecover: () => void
    const recoverPromise = new Promise<void>((resolve) => {
      resolveRecover = resolve
    })
    mockOnRecover.mockReturnValue(recoverPromise)

    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    const input = screen.getByPlaceholderText(/Enter your name/i)
    await user.type(input, 'TestUser')

    const submitButton = screen.getByRole('button', { name: /Recover Session/i })
    await user.click(submitButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Recovering...')).toBeInTheDocument()
    })

    // Resolve the promise
    resolveRecover!()

    await waitFor(() => {
      expect(screen.queryByText('Recovering...')).not.toBeInTheDocument()
    })
  })

  it('should show help text about recovery', () => {
    render(
      <RecoverSession
        eventCode={eventCode}
        onRecover={mockOnRecover}
        onClose={mockOnClose}
      />
    )

    expect(
      screen.getByText(/This only works if you previously joined this event/i)
    ).toBeInTheDocument()
  })
})
