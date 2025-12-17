const COLORS = [
  '#ffffff', // white
  '#000000', // black
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
]

interface ColorPaletteProps {
  selectedColor: string
  onColorChange: (color: string) => void
}

export function ColorPalette({ selectedColor, onColorChange }: ColorPaletteProps) {
  return (
    <div className="flex gap-2">
      {COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={`w-8 h-8 rounded-full border-2 transition-all ${
            selectedColor === color
              ? 'border-white scale-110'
              : 'border-dark-600 hover:border-dark-500'
          }`}
          style={{ backgroundColor: color }}
          aria-label={`Select color ${color}`}
        />
      ))}
    </div>
  )
}

