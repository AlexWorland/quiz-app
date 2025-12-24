import { AlertCircle, SkipForward } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface NoQuestionsNoticeProps {
  segmentTitle?: string
  presenterName: string
  onSkipSegment: () => void
  onRetryGeneration?: () => void
  onAddQuestions?: () => void
  isListenOnlyMode: boolean
}

export function NoQuestionsNotice({
  segmentTitle,
  presenterName,
  onSkipSegment,
  onRetryGeneration,
  onAddQuestions,
  isListenOnlyMode,
}: NoQuestionsNoticeProps) {
  return (
    <div className="bg-orange-900/20 border-2 border-orange-600 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <AlertCircle
          className="w-6 h-6 text-orange-400 mt-1 flex-shrink-0"
          data-testid="alert-circle-icon"
        />
        <div className="flex-1">
          <h3 className="text-orange-300 font-semibold text-lg mb-2">
            No Questions Generated
          </h3>
          <p className="text-orange-200/90 mb-3">
            {isListenOnlyMode ? (
              <>
                No quiz questions could be generated from{' '}
                <span className="font-semibold">{presenterName}</span>'s presentation
                {segmentTitle && ` - "${segmentTitle}"`}. This can happen when:
              </>
            ) : (
              <>
                No questions have been added for{' '}
                <span className="font-semibold">{presenterName}</span>'s segment
                {segmentTitle && ` - "${segmentTitle}"`}.
              </>
            )}
          </p>

          {isListenOnlyMode && (
            <ul className="text-orange-200/80 text-sm space-y-1 mb-4 ml-4">
              <li>• The recording was too short</li>
              <li>• The audio quality was poor</li>
              <li>• The content wasn't suitable for quiz questions</li>
            </ul>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              variant="primary"
              onClick={onSkipSegment}
              className="flex items-center gap-2"
            >
              <SkipForward className="w-4 h-4" data-testid="skip-forward-icon" />
              Skip to Next Presenter
            </Button>

            {onAddQuestions && (
              <Button
                variant="secondary"
                onClick={onAddQuestions}
                className="flex items-center gap-2"
              >
                Add Questions Manually
              </Button>
            )}

            {isListenOnlyMode && onRetryGeneration && (
              <Button
                variant="secondary"
                onClick={onRetryGeneration}
                className="flex items-center gap-2"
              >
                Retry Generation
              </Button>
            )}
          </div>

          {!isListenOnlyMode && (
            <p className="text-orange-300/70 text-sm mt-4">
              💡 Tip: Add questions manually or use bulk import before starting the quiz.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
