import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrushSizeSelector } from '../BrushSizeSelector'

describe('BrushSizeSelector', () => {
  const mockOnSizeChange = vi.fn()
  const sizes = [1, 3, 5, 8, 12]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all size buttons', () => {
    render(<BrushSizeSelector size={3} onSizeChange={mockOnSizeChange} />)

    sizes.forEach((size) => {
      const button = screen.getByLabelText(`Brush size ${size}`)
      expect(button).toBeInTheDocument()
    })
  })

  it('should call onSizeChange when clicking a size', async () => {
    const user = userEvent.setup()
    render(<BrushSizeSelector size={3} onSizeChange={mockOnSizeChange} />)

    const size8Button = screen.getByLabelText('Brush size 8')
    await user.click(size8Button)

    expect(mockOnSizeChange).toHaveBeenCalledWith(8)
  })

  it('should highlight selected size with border-accent-cyan class', () => {
    const { rerender } = render(<BrushSizeSelector size={3} onSizeChange={mockOnSizeChange} />)

    let button = screen.getByLabelText('Brush size 3')
    expect(button).toHaveClass('border-accent-cyan')

    rerender(<BrushSizeSelector size={8} onSizeChange={mockOnSizeChange} />)

    button = screen.getByLabelText('Brush size 8')
    expect(button).toHaveClass('border-accent-cyan')
  })

  it('should display Brush: label', () => {
    render(<BrushSizeSelector size={3} onSizeChange={mockOnSizeChange} />)

    const label = screen.getByText('Brush:')
    expect(label).toBeInTheDocument()
  })

  it('should have aria-label on each button', () => {
    render(<BrushSizeSelector size={3} onSizeChange={mockOnSizeChange} />)

    sizes.forEach((size) => {
      const button = screen.getByLabelText(`Brush size ${size}`)
      expect(button).toHaveAttribute('aria-label', `Brush size ${size}`)
    })
  })

  it('should apply correct styling to selected size', () => {
    const { rerender } = render(<BrushSizeSelector size={5} onSizeChange={mockOnSizeChange} />)

    let button = screen.getByLabelText('Brush size 5')
    expect(button).toHaveClass('border-accent-cyan')
    expect(button).toHaveClass('bg-accent-cyan/20')

    rerender(<BrushSizeSelector size={12} onSizeChange={mockOnSizeChange} />)

    button = screen.getByLabelText('Brush size 12')
    expect(button).toHaveClass('border-accent-cyan')
    expect(button).toHaveClass('bg-accent-cyan/20')
  })
})
