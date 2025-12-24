import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { JoinLockReminder } from '../JoinLockReminder'

describe('JoinLockReminder', () => {
  it('renders with correct duration in minutes and seconds', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={365} // 6m 5s
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText(/Joining has been locked for 6m 5s/)).toBeInTheDocument()
  })

  it('renders with correct duration for seconds only', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={45}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText(/Joining has been locked for 0m 45s/)).toBeInTheDocument()
  })

  it('calls onDismiss when Dismiss button is clicked', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    const dismissButton = screen.getByRole('button', { name: /Dismiss/ })
    fireEvent.click(dismissButton)

    expect(onDismiss).toHaveBeenCalled()
  })

  it('calls onUnlock when Unlock Now button is clicked', async () => {
    const onUnlock = vi.fn().mockResolvedValue(undefined)
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    const unlockButton = screen.getByRole('button', { name: /Unlock Now/ })
    fireEvent.click(unlockButton)

    await waitFor(() => {
      expect(onUnlock).toHaveBeenCalled()
    })
  })

  it('hides reminder when Dismiss is clicked', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText(/Joining has been locked for/)).toBeInTheDocument()

    const dismissButton = screen.getByRole('button', { name: /Dismiss/ })
    fireEvent.click(dismissButton)

    // After dismiss, reminder content should be gone
    expect(screen.queryByText(/Joining has been locked for/)).not.toBeInTheDocument()
  })

  it('hides reminder after successful unlock', async () => {
    const onUnlock = vi.fn().mockResolvedValue(undefined)
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText(/Joining has been locked for/)).toBeInTheDocument()

    const unlockButton = screen.getByRole('button', { name: /Unlock Now/ })
    fireEvent.click(unlockButton)

    await waitFor(() => {
      expect(screen.queryByText(/Joining has been locked for/)).not.toBeInTheDocument()
    })
  })

  it('shows loading state on Unlock Now button', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
        isLoading={true}
      />
    )

    const unlockButton = screen.getByRole('button', { name: /Unlocking/ })
    expect(unlockButton).toHaveAttribute('disabled')
  })

  it('displays alert icon and clock icon', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    // Check for mocked icons with testIds
    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument()
    expect(screen.getByTestId('clock-icon')).toBeInTheDocument()
  })

  it('has yellow styling for warning', () => {
    const onUnlock = vi.fn()
    const onDismiss = vi.fn()

    const { container } = render(
      <JoinLockReminder
        lockDuration={300}
        onUnlock={onUnlock}
        onDismiss={onDismiss}
      />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('bg-yellow-900/20')
    expect(wrapper).toHaveClass('border-yellow-600/60')
  })
})
