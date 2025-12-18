import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CanvasToolbar } from '../CanvasToolbar'

describe('CanvasToolbar', () => {
  const mockOnColorChange = vi.fn()
  const mockOnBrushSizeChange = vi.fn()
  const mockOnClear = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render ColorPalette and BrushSizeSelector', () => {
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    const colorButton = screen.getByLabelText('Select color #ffffff')
    const brushButton = screen.getByLabelText('Brush size 3')

    expect(colorButton).toBeInTheDocument()
    expect(brushButton).toBeInTheDocument()
  })

  it('should render Clear button when canClear is true (default)', () => {
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    const clearButton = screen.getByRole('button', { name: /Clear Canvas/i })
    expect(clearButton).toBeInTheDocument()
  })

  it('should hide Clear button when canClear is false', () => {
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
        canClear={false}
      />
    )

    const clearButton = screen.queryByRole('button', { name: /Clear Canvas/i })
    expect(clearButton).not.toBeInTheDocument()
  })

  it('should call onClear when Clear button clicked', async () => {
    const user = userEvent.setup()
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    const clearButton = screen.getByRole('button', { name: /Clear Canvas/i })
    await user.click(clearButton)

    expect(mockOnClear).toHaveBeenCalled()
  })

  it('should pass color prop to ColorPalette', () => {
    const { rerender } = render(
      <CanvasToolbar
        color="#ef4444"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    let selectedButton = screen.getByLabelText('Select color #ef4444')
    expect(selectedButton).toHaveClass('scale-110')

    rerender(
      <CanvasToolbar
        color="#3b82f6"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    selectedButton = screen.getByLabelText('Select color #3b82f6')
    expect(selectedButton).toHaveClass('scale-110')
  })

  it('should pass brushSize prop to BrushSizeSelector', () => {
    const { rerender } = render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={5}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    let selectedButton = screen.getByLabelText('Brush size 5')
    expect(selectedButton).toHaveClass('border-accent-cyan')

    rerender(
      <CanvasToolbar
        color="#ffffff"
        brushSize={12}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    selectedButton = screen.getByLabelText('Brush size 12')
    expect(selectedButton).toHaveClass('border-accent-cyan')
  })

  it('should call onColorChange when color is changed', async () => {
    const user = userEvent.setup()
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    const redButton = screen.getByLabelText('Select color #ef4444')
    await user.click(redButton)

    expect(mockOnColorChange).toHaveBeenCalledWith('#ef4444')
  })

  it('should call onBrushSizeChange when brush size is changed', async () => {
    const user = userEvent.setup()
    render(
      <CanvasToolbar
        color="#ffffff"
        brushSize={3}
        onColorChange={mockOnColorChange}
        onBrushSizeChange={mockOnBrushSizeChange}
        onClear={mockOnClear}
      />
    )

    const size8Button = screen.getByLabelText('Brush size 8')
    await user.click(size8Button)

    expect(mockOnBrushSizeChange).toHaveBeenCalledWith(8)
  })
})
