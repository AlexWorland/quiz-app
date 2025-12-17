import { Trash2 } from 'lucide-react'
import { Button } from '../common/Button'
import { ColorPalette } from './ColorPalette'
import { BrushSizeSelector } from './BrushSizeSelector'

interface CanvasToolbarProps {
  color: string
  brushSize: number
  onColorChange: (color: string) => void
  onBrushSizeChange: (size: number) => void
  onClear: () => void
  canClear?: boolean
}

export function CanvasToolbar({
  color,
  brushSize,
  onColorChange,
  onBrushSizeChange,
  onClear,
  canClear = true,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-dark-800 rounded-lg">
      <div className="flex items-center gap-4">
        <ColorPalette selectedColor={color} onColorChange={onColorChange} />
        <BrushSizeSelector size={brushSize} onSizeChange={onBrushSizeChange} />
      </div>
      {canClear && (
        <Button
          onClick={onClear}
          variant="secondary"
          className="flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear Canvas
        </Button>
      )}
    </div>
  )
}

