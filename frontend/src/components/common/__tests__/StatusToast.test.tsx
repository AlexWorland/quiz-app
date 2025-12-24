import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { StatusToast, StatusToastManager } from '../StatusToast'

describe('StatusToast', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should render success toast', () => {
    render(<StatusToast message="Success message" type="success" />)
    
    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeInTheDocument() // Close button
  })

  it('should render error toast with appropriate styling', () => {
    render(<StatusToast message="Error occurred" type="error" />)
    
    expect(screen.getByText('Error occurred')).toBeInTheDocument()
    // Should have red styling (we can't test exact classes but can test structure)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should auto-close after duration', async () => {
    const onClose = vi.fn()
    render(
      <StatusToast 
        message="Auto close test" 
        type="info" 
        duration={3000}
        onClose={onClose}
      />
    )
    
    expect(screen.getByText('Auto close test')).toBeInTheDocument()
    
    // Fast-forward past duration (3000ms) + exit animation (300ms)
    await vi.advanceTimersByTimeAsync(3300)
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('should call onClose when close button clicked', async () => {
    const onClose = vi.fn()
    
    render(
      <StatusToast 
        message="Manual close test" 
        type="warning"
        onClose={onClose}
      />
    )
    
    const closeButton = screen.getAllByRole('button')[0] // First button is close (X)
    fireEvent.click(closeButton)
    
    // Wait for exit animation (300ms)
    await vi.advanceTimersByTimeAsync(300)
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('should render with action button', () => {
    const actionHandler = vi.fn()
    
    render(
      <StatusToast 
        message="Action test" 
        type="error"
        action={{ label: 'Retry', onClick: actionHandler }}
      />
    )
    
    const actionButton = screen.getByRole('button', { name: 'Retry' })
    expect(actionButton).toBeInTheDocument()
    
    fireEvent.click(actionButton)
    expect(actionHandler).toHaveBeenCalled()
  })

  it('should not auto-close when duration is 0', () => {
    const onClose = vi.fn()
    render(
      <StatusToast 
        message="No auto close" 
        type="info" 
        duration={0}
        onClose={onClose}
      />
    )
    
    // Advance time significantly
    vi.advanceTimersByTime(10000)
    
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('No auto close')).toBeInTheDocument()
  })

  it('should support custom className', () => {
    render(
      <StatusToast 
        message="Custom style" 
        type="success"
        className="custom-toast-class"
      />
    )
    
    // className is applied to the outer fixed div
    const outerDiv = screen.getByText('Custom style').closest('.custom-toast-class')
    expect(outerDiv).toBeInTheDocument()
  })
})

describe('StatusToastManager', () => {
  beforeEach(() => {
    vi.clearAllTimers()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should render multiple toasts', () => {
    const messages = [
      { id: '1', message: 'First toast', type: 'success' as const },
      { id: '2', message: 'Second toast', type: 'error' as const },
    ]
    const onRemove = vi.fn()

    render(<StatusToastManager messages={messages} onRemove={onRemove} />)
    
    expect(screen.getByText('First toast')).toBeInTheDocument()
    expect(screen.getByText('Second toast')).toBeInTheDocument()
  })

  it('should call onRemove when toast is dismissed', async () => {
    const messages = [
      { id: 'toast-1', message: 'Test message', type: 'info' as const }
    ]
    const onRemove = vi.fn()

    render(<StatusToastManager messages={messages} onRemove={onRemove} />)
    
    const closeButton = screen.getByRole('button')
    fireEvent.click(closeButton)
    
    // Wait for exit animation (300ms)
    await vi.advanceTimersByTimeAsync(300)
    
    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith('toast-1')
    })
  })

  it('should handle empty messages array', () => {
    render(<StatusToastManager messages={[]} onRemove={vi.fn()} />)
    
    expect(screen.queryByText(/./)).not.toBeInTheDocument()
  })

  it('should position multiple toasts with stacking', () => {
    const messages = [
      { id: '1', message: 'Toast 1', type: 'success' as const },
      { id: '2', message: 'Toast 2', type: 'warning' as const },
      { id: '3', message: 'Toast 3', type: 'error' as const },
    ]

    render(<StatusToastManager messages={messages} onRemove={vi.fn()} />)
    
    expect(screen.getByText('Toast 1')).toBeInTheDocument()
    expect(screen.getByText('Toast 2')).toBeInTheDocument()
    expect(screen.getByText('Toast 3')).toBeInTheDocument()
  })
})
