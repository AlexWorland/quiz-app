import { X, RotateCw } from 'lucide-react'

interface ExportErrorNoticeProps {
  error: string
  retryCount?: number
  maxRetries?: number
  onRetry: () => void
  onDismiss: () => void
}

export const ExportErrorNotice = ({
  error,
  retryCount = 0,
  maxRetries = 3,
  onRetry,
  onDismiss,
}: ExportErrorNoticeProps) => {
  const attemptsRemaining = maxRetries - retryCount
  const canRetry = attemptsRemaining > 0

  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-600 bg-red-900/20 p-4 text-red-200">
      <div className="flex-1">
        <p className="font-semibold text-red-100">Export Failed</p>
        <p className="mt-1 text-sm">{error}</p>
        {canRetry && (
          <p className="mt-2 text-xs text-red-300">
            Retries remaining: {attemptsRemaining} of {maxRetries}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {canRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 rounded-md bg-red-600 px-3 py-1 text-sm hover:bg-red-700"
          >
            <RotateCw size={14} />
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          className="rounded-md p-1 hover:bg-red-800/50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
