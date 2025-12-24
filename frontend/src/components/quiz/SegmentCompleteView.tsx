import { useState } from 'react'
import { Trophy, RotateCcw } from 'lucide-react'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import { Button } from '@/components/common/Button'
import type { LeaderboardEntry } from '@/api/endpoints'

interface SegmentCompleteViewProps {
  segmentTitle: string
  segmentLeaderboard: LeaderboardEntry[]
  eventLeaderboard: LeaderboardEntry[]
  segmentWinner?: LeaderboardEntry
  isPresenter: boolean
  isHost?: boolean
  onShowOverallLeaderboard?: () => void
  onPassPresenter?: () => void
  onResumeSegment?: () => void
}

export function SegmentCompleteView({
  segmentTitle,
  segmentLeaderboard,
  eventLeaderboard,
  segmentWinner,
  isPresenter,
  isHost = false,
  onPassPresenter,
  onResumeSegment
}: SegmentCompleteViewProps) {
  const [showingOverall, setShowingOverall] = useState(false)

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Segment Winner Announcement */}
      {segmentWinner && (
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold">
            {segmentWinner.username} wins {segmentTitle || 'this round'}
          </h2>
          <p className="text-gray-600">
            Score: {segmentWinner.score} points
          </p>
        </div>
      )}

      {/* Toggle between segment and overall */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowingOverall(false)}
          className={`flex-1 py-2 rounded ${!showingOverall ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          This Segment
        </button>
        <button
          onClick={() => setShowingOverall(true)}
          className={`flex-1 py-2 rounded ${showingOverall ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Overall Standings
        </button>
      </div>

      {/* Leaderboard */}
      {showingOverall ? (
        <MasterLeaderboard rankings={eventLeaderboard} />
      ) : (
        <SegmentLeaderboard rankings={segmentLeaderboard} />
      )}

      {/* Presenter Controls */}
      {isPresenter && onPassPresenter && (
        <div className="mt-6">
          <Button onClick={onPassPresenter} className="w-full">
            Pass Presenter Role
          </Button>
        </div>
      )}

      {/* Host-only: Resume Segment */}
      {isHost && onResumeSegment && (
        <div className="mt-4">
          <button
            onClick={onResumeSegment}
            className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/40 rounded-lg text-sm text-amber-300 hover:text-amber-200 transition"
            title="Resume this segment if it was ended accidentally"
          >
            <RotateCcw className="w-4 h-4" />
            Resume Segment
          </button>
          <p className="text-xs text-gray-500 mt-1 text-center">
            Use this if the segment was ended accidentally
          </p>
        </div>
      )}
    </div>
  )
}

