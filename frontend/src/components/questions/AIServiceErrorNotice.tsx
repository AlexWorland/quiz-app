import { AlertTriangle, RotateCcw, Zap, SkipForward } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface AIServiceErrorNoticeProps {
  errorType: 'service_unavailable' | 'rate_limit' | 'connection_error' | 'unknown'
  segmentTitle?: string
  presenterName: string
  onRetryGeneration: () => void
  onSwitchToManual: () => void
  onSkipSegment: () => void
  isRetrying?: boolean
}

export function AIServiceErrorNotice({
  errorType,
  segmentTitle,
  presenterName,
  onRetryGeneration,
  onSwitchToManual,
  onSkipSegment,
  isRetrying,
}: AIServiceErrorNoticeProps) {
  const getErrorInfo = () => {
    switch (errorType) {
      case 'service_unavailable':
        return {
          title: 'AI Service Unavailable',
          message: 'The question generation service is temporarily unavailable.',
          details: 'This could be due to maintenance or high load.',
          icon: AlertTriangle,
        }
      case 'rate_limit':
        return {
          title: 'Rate Limit Exceeded',
          message: 'Question generation is temporarily unavailable due to rate limiting.',
          details: 'Please wait a moment and try again, or switch to manual mode.',
          icon: Zap,
        }
      case 'connection_error':
        return {
          title: 'Connection Failed',
          message: 'Failed to connect to the question generation service.',
          details: 'Check your internet connection and try again.',
          icon: AlertTriangle,
        }
      default:
        return {
          title: 'Generation Failed',
          message: 'An unexpected error occurred while generating questions.',
          details: 'Please try again or switch to manual mode.',
          icon: AlertTriangle,
        }
    }
  }

  const { title, message, details, icon: IconComponent } = getErrorInfo()

  return (
    <div className="bg-orange-900/20 border-2 border-orange-600 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <IconComponent className="w-6 h-6 text-orange-400 mt-1 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-orange-300 font-semibold text-lg mb-2">{title}</h3>
          <p className="text-orange-200/90 mb-2">{message}</p>
          <p className="text-orange-200/70 text-sm mb-4">{details}</p>

          <p className="text-orange-200/80 text-sm mb-4">
            Presenter: <span className="font-semibold">{presenterName}</span>
            {segmentTitle && ` • Segment: "${segmentTitle}"`}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              onClick={onRetryGeneration}
              disabled={isRetrying}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {isRetrying ? 'Retrying...' : 'Retry Generation'}
            </Button>

            <Button
              variant="secondary"
              onClick={onSwitchToManual}
              className="flex items-center gap-2"
            >
              Create Questions Manually
            </Button>

            <Button
              variant="secondary"
              onClick={onSkipSegment}
              className="flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" />
              Skip Segment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
