import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColorPalette } from '../ColorPalette'

describe('ColorPalette', () => {
  const mockOnColorChange = vi.fn()
  const colors = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all color buttons', () => {
    render(<ColorPalette selectedColor="#ffffff" onColorChange={mockOnColorChange} />)

    colors.forEach((color) => {
      const button = screen.getByLabelText(`Select color ${color}`)
      expect(button).toBeInTheDocument()
    })
  })

  it('should call onColorChange when clicking a color', async () => {
    const user = userEvent.setup()
    render(<ColorPalette selectedColor="#ffffff" onColorChange={mockOnColorChange} />)

    const redButton = screen.getByLabelText('Select color #ef4444')
    await user.click(redButton)

    expect(mockOnColorChange).toHaveBeenCalledWith('#ef4444')
  })

  it('should highlight selected color with scale-110 class', () => {
    const { rerender } = render(<ColorPalette selectedColor="#ffffff" onColorChange={mockOnColorChange} />)

    let button = screen.getByLabelText('Select color #ffffff')
    expect(button).toHaveClass('scale-110')

    rerender(<ColorPalette selectedColor="#ef4444" onColorChange={mockOnColorChange} />)

    button = screen.getByLabelText('Select color #ef4444')
    expect(button).toHaveClass('scale-110')
  })

  it('should have aria-label on each button', () => {
    render(<ColorPalette selectedColor="#ffffff" onColorChange={mockOnColorChange} />)

    colors.forEach((color) => {
      const button = screen.getByLabelText(`Select color ${color}`)
      expect(button).toHaveAttribute('aria-label', `Select color ${color}`)
    })
  })

  it('should apply correct background color to buttons', () => {
    render(<ColorPalette selectedColor="#ffffff" onColorChange={mockOnColorChange} />)

    const redButton = screen.getByLabelText('Select color #ef4444')
    expect(redButton).toHaveStyle({ backgroundColor: '#ef4444' })

    const blueButton = screen.getByLabelText('Select color #3b82f6')
    expect(blueButton).toHaveStyle({ backgroundColor: '#3b82f6' })
  })
})
