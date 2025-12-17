interface BrushSizeSelectorProps {
  size: number
  onSizeChange: (size: number) => void
}

const SIZES = [1, 3, 5, 8, 12]

export function BrushSizeSelector({ size, onSizeChange }: BrushSizeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Brush:</span>
      <div className="flex gap-2">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => onSizeChange(s)}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
              size === s
                ? 'border-accent-cyan bg-accent-cyan/20'
                : 'border-dark-600 hover:border-dark-500'
            }`}
            aria-label={`Brush size ${s}`}
          >
            <div
              className="rounded-full bg-white"
              style={{ width: s, height: s }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

