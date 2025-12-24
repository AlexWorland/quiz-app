import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'

interface RecoverSessionProps {
  eventCode: string
  onRecover: (displayName: string) => Promise<void>
  onClose: () => void
}

export function RecoverSession({
  eventCode,
  onRecover,
  onClose,
}: RecoverSessionProps) {
  const [displayName, setDisplayName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!displayName.trim()) {
      setError('Please enter your display name')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onRecover(displayName.trim())
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('404') || err.message.includes('not found')) {
          setError('No participant found with that name. Check spelling or join as new participant.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to recover session')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Recover Session
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-300 text-sm mb-4">
          If you lost your session (cleared browser data), enter your display name to reconnect and preserve your score.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Display Name
            </label>
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name from this event"
              maxLength={50}
              autoFocus
              disabled={isSubmitting}
            />
            <p className="text-slate-500 text-xs mt-1">
              Event: <span className="font-mono">{eventCode}</span>
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
              disabled={isSubmitting || !displayName.trim()}
              className="flex-1"
            >
              {isSubmitting ? 'Recovering...' : 'Recover Session'}
            </Button>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-400">
            💡 This only works if you previously joined this event with a different device or cleared your browser data.
          </p>
        </div>
      </div>
    </div>
  )
}
