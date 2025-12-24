import { useState, useEffect } from 'react'
import { Book, Play, ArrowRight, Trophy, Users, Clock } from 'lucide-react'
import { Button } from '@/components/common/Button'
import type { LeaderboardEntry } from '@/api/endpoints'

interface SingleSegmentReviewProps {
  eventId: string
  eventTitle: string
  segmentTitle?: string
  availableQuestions: number
  currentLeaderboard: LeaderboardEntry[]
  onStartReview: (questionCount: number) => void
  onSkipToResults: () => void
  isHost?: boolean
}

export function SingleSegmentReview({
  eventId,
  eventTitle,
  segmentTitle,
  availableQuestions,
  currentLeaderboard,
  onStartReview,
  onSkipToResults,
  isHost = false
}: SingleSegmentReviewProps) {
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(
    Math.min(availableQuestions, 5) // Default to 5 or all available
  )
  const [countdown, setCountdown] = useState(10)
  const [autoStart, setAutoStart] = useState(true)

  // Auto-start countdown for host
  useEffect(() => {
    if (!isHost || !autoStart) return

    if (countdown <= 0) {
      onStartReview(selectedQuestionCount)
      return
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, autoStart, isHost, selectedQuestionCount, onStartReview])

  const questionCountOptions = [
    Math.min(3, availableQuestions),
    Math.min(5, availableQuestions), 
    Math.min(10, availableQuestions),
    availableQuestions
  ].filter((count, index, arr) => count > 0 && arr.indexOf(count) === index)

  return (
    <div className="bg-gradient-to-br from-purple-900/40 via-blue-900/40 to-indigo-900/40 rounded-lg border border-purple-500/30 p-8 text-center">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="relative">
            <Book className="w-16 h-16 text-purple-300" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-2">
          Ready for Final Review
        </h2>
        
        <p className="text-purple-200 text-lg mb-2">
          Single presenter event completed!
        </p>
        
        <p className="text-purple-300/80 text-sm">
          {segmentTitle ? `"${segmentTitle}"` : 'The presentation'} has ended.
          Review the questions or go straight to results.
        </p>
      </div>

      {/* Event Summary */}
      <div className="bg-white/5 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{eventTitle}</div>
            <div className="text-purple-300 text-sm">Event</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-300">{availableQuestions}</div>
            <div className="text-purple-300 text-sm">Questions Available</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-300">{currentLeaderboard.length}</div>
            <div className="text-purple-300 text-sm">Participants</div>
          </div>
        </div>
      </div>

      {/* Current Standings Preview */}
      {currentLeaderboard.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <h3 className="text-purple-200 font-semibold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Current Standings
          </h3>
          <div className="space-y-2">
            {currentLeaderboard.slice(0, 3).map((entry, index) => (
              <div key={entry.user_id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-purple-300">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                  <span className="text-white">{entry.username}</span>
                </div>
                <span className="text-purple-300 font-bold">{entry.score}</span>
              </div>
            ))}
            {currentLeaderboard.length > 3 && (
              <p className="text-purple-400/70 text-xs text-center">
                + {currentLeaderboard.length - 3} more participants
              </p>
            )}
          </div>
        </div>
      )}

      {/* Question Count Selection */}
      {isHost && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-purple-200 font-semibold mb-3">Review Questions</h3>
          <p className="text-purple-300/80 text-sm mb-4">
            Choose how many questions to include in the final review:
          </p>
          
          <div className="flex gap-2 justify-center flex-wrap">
            {questionCountOptions.map(count => (
              <button
                key={count}
                onClick={() => setSelectedQuestionCount(count)}
                className={`px-4 py-2 rounded-lg border-2 transition ${
                  selectedQuestionCount === count
                    ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                    : 'border-purple-500/30 text-purple-300 hover:border-purple-500/60'
                }`}
              >
                {count === availableQuestions ? 'All' : count} Question{count !== 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center flex-wrap">
        {isHost ? (
          <>
            <Button
              onClick={() => onStartReview(selectedQuestionCount)}
              variant="primary"
              className="flex items-center gap-2"
              disabled={availableQuestions === 0}
            >
              <Play className="w-4 h-4" />
              {autoStart && countdown > 0 
                ? `Start Review (${countdown}s)` 
                : 'Start Review Quiz'
              }
            </Button>

            <Button
              onClick={() => {
                setAutoStart(false)
                onSkipToResults()
              }}
              variant="secondary"
              className="flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              Skip to Final Results
            </Button>

            {autoStart && countdown > 0 && (
              <Button
                onClick={() => setAutoStart(false)}
                variant="secondary"
                className="text-sm"
              >
                Cancel Auto-start
              </Button>
            )}
          </>
        ) : (
          <div className="text-purple-300/80 text-sm">
            <Users className="w-4 h-4 inline mr-1" />
            Waiting for host to start the final review...
          </div>
        )}
      </div>

      {/* Auto-start indicator */}
      {isHost && autoStart && countdown > 0 && (
        <p className="text-purple-400/60 text-xs mt-4">
          Review will start automatically in {countdown} seconds with {selectedQuestionCount} questions
        </p>
      )}

      {/* No questions warning */}
      {availableQuestions === 0 && (
        <div className="mt-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded text-sm">
          <p className="text-orange-200">
            No questions are available for review. Proceeding directly to final results.
          </p>
        </div>
      )}
    </div>
  )
}
