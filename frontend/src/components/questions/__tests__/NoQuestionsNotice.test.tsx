import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NoQuestionsNotice } from '../NoQuestionsNotice'

describe('NoQuestionsNotice', () => {
  it('should render notice for listen-only mode', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={true}
      />
    )

    expect(screen.getByText('No Questions Generated')).toBeInTheDocument()
    expect(screen.getByText(/No quiz questions could be generated from/i)).toBeInTheDocument()
    expect(screen.getByText(/John Doe/i)).toBeInTheDocument()
  })

  it('should render notice for non-listen-only mode (legacy)', () => {
    render(
      <NoQuestionsNotice
        presenterName="Jane Smith"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={false}
      />
    )

    expect(screen.getByText(/No questions have been added for/i)).toBeInTheDocument()
    expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument()
  })

  it('should show segment title when provided', () => {
    render(
      <NoQuestionsNotice
        segmentTitle="Introduction to Testing"
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={true}
      />
    )

    expect(screen.getByText(/Introduction to Testing/i)).toBeInTheDocument()
  })

  it('should show reasons for listen-only mode', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={true}
      />
    )

    expect(screen.getByText(/The recording was too short/i)).toBeInTheDocument()
    expect(screen.getByText(/The audio quality was poor/i)).toBeInTheDocument()
    expect(screen.getByText(/wasn't suitable for quiz questions/i)).toBeInTheDocument()
  })

  it('should not show reasons for non-listen-only mode (legacy)', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={false}
      />
    )

    expect(screen.queryByText(/The recording was too short/i)).not.toBeInTheDocument()
  })

  it('should show tip for non-listen-only mode (legacy)', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={false}
      />
    )

    expect(screen.getByText(/Add questions manually or use bulk import/i)).toBeInTheDocument()
  })

  it('should not show tip for listen-only mode', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={true}
      />
    )

    expect(screen.queryByText(/Add questions manually/i)).not.toBeInTheDocument()
  })

  it('should call onSkipSegment when skip button clicked', async () => {
    const user = userEvent.setup()
    const onSkip = vi.fn()

    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={onSkip}
        isListenOnlyMode={false}
      />
    )

    const skipButton = screen.getByRole('button', { name: /Skip to Next Presenter/i })
    await user.click(skipButton)

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('should call onAddQuestions when add button clicked', async () => {
    const user = userEvent.setup()
    const onAddQuestions = vi.fn()

    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        onAddQuestions={onAddQuestions}
        isListenOnlyMode={false}
      />
    )

    const addButton = screen.getByRole('button', { name: /Add Questions Manually/i })
    await user.click(addButton)

    expect(onAddQuestions).toHaveBeenCalledTimes(1)
  })

  it('should show retry button in listen-only mode when callback provided', () => {
    const onRetry = vi.fn()

    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        onRetryGeneration={onRetry}
        isListenOnlyMode={true}
      />
    )

    expect(screen.getByRole('button', { name: /Retry Generation/i })).toBeInTheDocument()
  })

  it('should not show retry button in non-listen-only mode (legacy)', () => {
    const onRetry = vi.fn()

    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        onRetryGeneration={onRetry}
        isListenOnlyMode={false}
      />
    )

    expect(screen.queryByRole('button', { name: /Retry Generation/i })).not.toBeInTheDocument()
  })

  it('should call onRetryGeneration when retry button clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        onRetryGeneration={onRetry}
        isListenOnlyMode={true}
      />
    )

    const retryButton = screen.getByRole('button', { name: /Retry Generation/i })
    await user.click(retryButton)

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('should show alert icon', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={false}
      />
    )

    expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument()
  })

  it('should show skip icon on button', () => {
    render(
      <NoQuestionsNotice
        presenterName="John Doe"
        onSkipSegment={vi.fn()}
        isListenOnlyMode={false}
      />
    )

    expect(screen.getByTestId('skip-forward-icon')).toBeInTheDocument()
  })
})
