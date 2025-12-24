import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  beforeEach(() => {
    // Mock createPortal to render inline for testing
    vi.mock('react-dom', async () => {
      const actual = await vi.importActual('react-dom')
      return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should render trigger element', () => {
    render(
      <Tooltip content="Test tooltip">
        <button>Trigger</button>
      </Tooltip>
    )
    
    expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument()
  })

  it('should show tooltip on hover by default', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Test tooltip content">
        <button>Hover me</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button', { name: 'Hover me' })
    
    // Hover over trigger
    await user.hover(trigger)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Test tooltip content')).toBeInTheDocument()
    })
    
    // Unhover
    await user.unhover(trigger)
    
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should show tooltip on click when trigger is click', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Click tooltip" trigger="click">
        <button>Click me</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button', { name: 'Click me' })
    
    // Click to show
    await user.click(trigger)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Click tooltip')).toBeInTheDocument()
    })
    
    // Click again to hide
    await user.click(trigger)
    
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should hide tooltip when clicking outside (click trigger)', async () => {
    const user = userEvent.setup()
    
    render(
      <div>
        <Tooltip content="Click tooltip" trigger="click">
          <button>Click me</button>
        </Tooltip>
        <div data-testid="outside">Outside</div>
      </div>
    )
    
    const trigger = screen.getByRole('button', { name: 'Click me' })
    const outside = screen.getByTestId('outside')
    
    // Show tooltip
    await user.click(trigger)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
    
    // Click outside
    await user.click(outside)
    
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should hide tooltip when pressing Escape key', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Escape tooltip" trigger="click">
        <button>Click me</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button', { name: 'Click me' })
    
    // Show tooltip
    await user.click(trigger)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })
    
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  it('should support different positions', () => {
    const { rerender } = render(
      <Tooltip content="Top tooltip" position="top">
        <button>Button</button>
      </Tooltip>
    )
    
    expect(screen.getByRole('button')).toBeInTheDocument()
    
    rerender(
      <Tooltip content="Bottom tooltip" position="bottom">
        <button>Button</button>
      </Tooltip>
    )
    
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should accept custom className', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Custom tooltip" className="custom-tooltip">
        <button>Button</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button')
    await user.hover(trigger)
    
    await waitFor(() => {
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveClass('custom-tooltip')
    })
  })

  it('should support ReactNode content', async () => {
    const user = userEvent.setup()
    
    const content = (
      <div>
        <strong>Bold text</strong>
        <br />
        <em>Italic text</em>
      </div>
    )
    
    render(
      <Tooltip content={content}>
        <button>Complex content</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button')
    await user.hover(trigger)
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Bold text')).toBeInTheDocument()
      expect(screen.getByText('Italic text')).toBeInTheDocument()
    })
  })

  it('should handle delay prop', async () => {
    const user = userEvent.setup()
    
    render(
      <Tooltip content="Delayed tooltip" delay={100}>
        <button>Delayed</button>
      </Tooltip>
    )
    
    const trigger = screen.getByRole('button')
    await user.hover(trigger)
    
    // Should not appear immediately
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    
    // Should appear after delay
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    }, { timeout: 200 })
  })
})
