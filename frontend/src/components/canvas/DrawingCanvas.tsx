import { useRef, useEffect, useState, useCallback } from 'react'

interface Point {
  x: number
  y: number
}

interface Stroke {
  points: Point[]
  color: string
  width: number
}

interface DrawingCanvasProps {
  width: number
  height: number
  onStrokeComplete?: (stroke: Stroke) => void
  initialStrokes?: Stroke[]
  disabled?: boolean
}

export function DrawingCanvas({
  width,
  height,
  onStrokeComplete,
  initialStrokes = [],
  disabled = false,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes)
  const [color] = useState('#ffffff')
  const [brushWidth] = useState(3)

  useEffect(() => {
    setStrokes(initialStrokes)
  }, [initialStrokes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, width, height)

    // Draw all strokes
    strokes.forEach((stroke) => {
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      stroke.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
    })

    // Draw current stroke
    if (currentStroke.length > 0) {
      ctx.strokeStyle = color
      ctx.lineWidth = brushWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      ctx.beginPath()
      currentStroke.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
    }
  }, [strokes, currentStroke, color, brushWidth, width, height])

  const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    let x: number, y: number

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    return { x, y }
  }

  const handleStart = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (disabled) return
      e.preventDefault()
      const point = getPointFromEvent(e)
      if (point) {
        setIsDrawing(true)
        setCurrentStroke([point])
      }
    },
    [disabled]
  )

  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      if (disabled || !isDrawing) return
      e.preventDefault()
      const point = getPointFromEvent(e)
      if (point) {
        setCurrentStroke((prev) => [...prev, point])
      }
    },
    [disabled, isDrawing]
  )

  const handleEnd = useCallback(() => {
    if (!isDrawing || currentStroke.length === 0) return

    const stroke: Stroke = {
      points: currentStroke,
      color,
      width: brushWidth,
    }

    setStrokes((prev) => [...prev, stroke])
    setCurrentStroke([])
    setIsDrawing(false)

    if (onStrokeComplete) {
      onStrokeComplete(stroke)
    }
  }, [isDrawing, currentStroke, color, brushWidth, onStrokeComplete])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      className="border border-dark-700 rounded-lg cursor-crosshair touch-none"
      style={{ backgroundColor: '#1a1a1a' }}
    />
  )
}

