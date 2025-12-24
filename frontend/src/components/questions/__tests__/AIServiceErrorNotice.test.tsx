import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIServiceErrorNotice } from '../AIServiceErrorNotice'

describe('AIServiceErrorNotice', () => {
  const defaultProps = {
    errorType: 'service_unavailable' as const,
    presenterName: 'John Doe',
    onRetryGeneration: vi.fn(),
    onSwitchToManual: vi.fn(),
    onSkipSegment: vi.fn(),
  }

  it('renders with service_unavailable error type', () => {
    render(<AIServiceErrorNotice {...defaultProps} />)

    expect(screen.getByText('AI Service Unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('The question generation service is temporarily unavailable.')
    ).toBeInTheDocument()
  })

  it('renders with rate_limit error type', () => {
    render(
      <AIServiceErrorNotice {...defaultProps} errorType="rate_limit" />
    )

    expect(screen.getByText('Rate Limit Exceeded')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Question generation is temporarily unavailable due to rate limiting.'
      )
    ).toBeInTheDocument()
  })

  it('renders with connection_error error type', () => {
    render(
      <AIServiceErrorNotice {...defaultProps} errorType="connection_error" />
    )

    expect(screen.getByText('Connection Failed')).toBeInTheDocument()
    expect(
      screen.getByText('Failed to connect to the question generation service.')
    ).toBeInTheDocument()
  })

  it('renders with unknown error type', () => {
    render(<AIServiceErrorNotice {...defaultProps} errorType="unknown" />)

    expect(screen.getByText('Generation Failed')).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred while generating questions.')
    ).toBeInTheDocument()
  })

  it('displays presenter name', () => {
    render(<AIServiceErrorNotice {...defaultProps} presenterName="Jane Smith" />)

    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument()
  })

  it('displays segment title when provided', () => {
    render(
      <AIServiceErrorNotice
        {...defaultProps}
        segmentTitle="Introduction Segment"
      />
    )

    expect(screen.getByText(/Introduction Segment/)).toBeInTheDocument()
  })

  it('does not display segment title when not provided', () => {
    const { container } = render(
      <AIServiceErrorNotice {...defaultProps} />
    )

    expect(container.textContent).not.toMatch(/Segment:/)
  })

  it('calls onRetryGeneration when retry button clicked', async () => {
    const user = userEvent.setup()
    render(<AIServiceErrorNotice {...defaultProps} />)

    const retryButton = screen.getByText('Retry Generation')
    await user.click(retryButton)

    expect(defaultProps.onRetryGeneration).toHaveBeenCalledOnce()
  })

  it('calls onSwitchToManual when manual button clicked', async () => {
    const user = userEvent.setup()
    render(<AIServiceErrorNotice {...defaultProps} />)

    const manualButton = screen.getByText('Create Questions Manually')
    await user.click(manualButton)

    expect(defaultProps.onSwitchToManual).toHaveBeenCalledOnce()
  })

  it('calls onSkipSegment when skip button clicked', async () => {
    const user = userEvent.setup()
    render(<AIServiceErrorNotice {...defaultProps} />)

    const skipButton = screen.getByText('Skip Segment')
    await user.click(skipButton)

    expect(defaultProps.onSkipSegment).toHaveBeenCalledOnce()
  })

  it('disables retry button when isRetrying is true', () => {
    render(
      <AIServiceErrorNotice {...defaultProps} isRetrying />
    )

    const retryButton = screen.getByRole('button', {
      name: /Retrying/,
    })

    expect(retryButton).toBeDisabled()
  })

  it('shows loading state in retry button when isRetrying', () => {
    render(
      <AIServiceErrorNotice {...defaultProps} isRetrying />
    )

    expect(screen.getByText('Retrying...')).toBeInTheDocument()
  })

  it('renders all action buttons', () => {
    render(<AIServiceErrorNotice {...defaultProps} />)

    expect(screen.getByText('Retry Generation')).toBeInTheDocument()
    expect(screen.getByText('Create Questions Manually')).toBeInTheDocument()
    expect(screen.getByText('Skip Segment')).toBeInTheDocument()
  })

  it('applies correct styling classes', () => {
    const { container } = render(<AIServiceErrorNotice {...defaultProps} />)

    const alertDiv = container.querySelector('.bg-orange-900\\/20')
    expect(alertDiv).toBeInTheDocument()
    expect(alertDiv).toHaveClass('border-2', 'border-orange-600', 'rounded-lg', 'p-6')
  })
})
