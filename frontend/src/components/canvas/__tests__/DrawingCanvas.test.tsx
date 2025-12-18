import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrawingCanvas } from '../DrawingCanvas'

describe('DrawingCanvas', () => {
  const mockOnStrokeComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render canvas with correct width and height', () => {
    render(<DrawingCanvas width={800} height={600} onStrokeComplete={mockOnStrokeComplete} />)

    const canvas = screen.getByRole('img', { hidden: true }) as HTMLCanvasElement
    expect(canvas).toHaveAttribute('width', '800')
    expect(canvas).toHaveAttribute('height', '600')
  })

  it('should have touch-none class', () => {
    render(<DrawingCanvas width={800} height={600} onStrokeComplete={mockOnStrokeComplete} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toHaveClass('touch-none')
  })

  it('should not respond to events when disabled', () => {
    render(
      <DrawingCanvas
        width={800}
        height={600}
        onStrokeComplete={mockOnStrokeComplete}
        disabled={true}
      />
    )

    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    fireEvent.mouseDown(canvas, {
      clientX: rect.left + 10,
      clientY: rect.top + 10,
    })

    fireEvent.mouseMove(canvas, {
      clientX: rect.left + 50,
      clientY: rect.top + 50,
    })

    fireEvent.mouseUp(canvas)

    expect(mockOnStrokeComplete).not.toHaveBeenCalled()
  })

  it('should render initialStrokes', () => {
    const initialStrokes = [
      {
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
        color: '#ffffff',
        width: 3,
      },
    ]

    render(
      <DrawingCanvas
        width={800}
        height={600}
        onStrokeComplete={mockOnStrokeComplete}
        initialStrokes={initialStrokes}
      />
    )

    const canvas = document.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('should call onStrokeComplete after drawing', () => {
    render(
      <DrawingCanvas
        width={800}
        height={600}
        onStrokeComplete={mockOnStrokeComplete}
      />
    )

    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    fireEvent.mouseDown(canvas, {
      clientX: rect.left + 10,
      clientY: rect.top + 10,
    })

    fireEvent.mouseMove(canvas, {
      clientX: rect.left + 50,
      clientY: rect.top + 50,
    })

    fireEvent.mouseUp(canvas)

    expect(mockOnStrokeComplete).toHaveBeenCalled()
    expect(mockOnStrokeComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        points: expect.any(Array),
        color: expect.any(String),
        width: expect.any(Number),
      })
    )
  })

  it('should handle multiple strokes', () => {
    render(
      <DrawingCanvas
        width={800}
        height={600}
        onStrokeComplete={mockOnStrokeComplete}
      />
    )

    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    // First stroke
    fireEvent.mouseDown(canvas, {
      clientX: rect.left + 10,
      clientY: rect.top + 10,
    })
    fireEvent.mouseMove(canvas, {
      clientX: rect.left + 50,
      clientY: rect.top + 50,
    })
    fireEvent.mouseUp(canvas)

    // Second stroke
    fireEvent.mouseDown(canvas, {
      clientX: rect.left + 100,
      clientY: rect.top + 100,
    })
    fireEvent.mouseMove(canvas, {
      clientX: rect.left + 150,
      clientY: rect.top + 150,
    })
    fireEvent.mouseUp(canvas)

    expect(mockOnStrokeComplete).toHaveBeenCalledTimes(2)
  })

  it('should have correct border and cursor classes', () => {
    render(<DrawingCanvas width={800} height={600} onStrokeComplete={mockOnStrokeComplete} />)

    const canvas = document.querySelector('canvas')
    expect(canvas).toHaveClass('border')
    expect(canvas).toHaveClass('border-dark-700')
    expect(canvas).toHaveClass('rounded-lg')
    expect(canvas).toHaveClass('cursor-crosshair')
  })

  it('should handle touch events', () => {
    render(
      <DrawingCanvas
        width={800}
        height={600}
        onStrokeComplete={mockOnStrokeComplete}
      />
    )

    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()

    fireEvent.touchStart(canvas, {
      touches: [
        {
          clientX: rect.left + 10,
          clientY: rect.top + 10,
        } as Touch,
      ],
    })

    fireEvent.touchMove(canvas, {
      touches: [
        {
          clientX: rect.left + 50,
          clientY: rect.top + 50,
        } as Touch,
      ],
    })

    fireEvent.touchEnd(canvas)

    expect(mockOnStrokeComplete).toHaveBeenCalled()
  })
})
