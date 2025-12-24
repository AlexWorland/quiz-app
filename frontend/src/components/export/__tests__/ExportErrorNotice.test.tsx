import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportErrorNotice } from '../ExportErrorNotice'

describe('ExportErrorNotice', () => {
  it('renders error message', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Network timeout occurred"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText('Export Failed')).toBeInTheDocument()
    expect(screen.getByText('Network timeout occurred')).toBeInTheDocument()
  })

  it('shows retry button when retries remaining', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Export failed"
        retryCount={1}
        maxRetries={3}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText('Retries remaining: 2 of 3')).toBeInTheDocument()
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('hides retry button when max retries reached', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Export failed after all retries"
        retryCount={3}
        maxRetries={3}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Export failed"
        retryCount={0}
        maxRetries={3}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls onDismiss when dismiss button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Export failed"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    const dismissButton = screen.getAllByRole('button').find((btn) =>
      btn.className.includes('hover:bg-red-800')
    )
    expect(dismissButton).toBeInTheDocument()
    await user.click(dismissButton!)

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('displays correct retry counts', () => {
    const onRetry = vi.fn()
    const onDismiss = vi.fn()

    render(
      <ExportErrorNotice
        error="Export failed"
        retryCount={2}
        maxRetries={3}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    )

    expect(screen.getByText('Retries remaining: 1 of 3')).toBeInTheDocument()
  })
})
