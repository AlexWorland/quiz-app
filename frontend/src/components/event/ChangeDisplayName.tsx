import { useState } from 'react'
import { User, X, Check } from 'lucide-react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'

interface ChangeDisplayNameProps {
  currentName: string
  onNameChange: (newName: string) => Promise<void>
  onClose: () => void
}

export function ChangeDisplayName({
  currentName,
  onNameChange,
  onClose,
}: ChangeDisplayNameProps) {
  const [newName, setNewName] = useState(currentName)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = newName.trim()
    if (!trimmedName) {
      setError('Display name cannot be empty')
      return
    }

    if (trimmedName === currentName) {
      onClose()
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onNameChange(trimmedName)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change name')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5" />
            Change Display Name
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Display Name
            </label>
            <Input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new name"
              maxLength={50}
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-slate-500 text-xs mt-1">
              This is how you'll appear on the leaderboard
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !newName.trim() || newName.trim() === currentName}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                'Changing...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Change Name
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
