import { Crown } from 'lucide-react'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import type { LeaderboardEntry } from '@/api/endpoints'

interface SegmentWinner {
  segment_id: string
  segment_title: string
  winner_name: string
  winner_score: number
}

interface EventCompleteViewProps {
  finalLeaderboard: LeaderboardEntry[]
  winner?: LeaderboardEntry
  segmentWinners: SegmentWinner[]
}

export function EventCompleteView({
  finalLeaderboard,
  winner,
  segmentWinners
}: EventCompleteViewProps) {
  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      {/* Grand Winner */}
      {winner && (
        <div className="mb-8">
          <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">
            {winner.username} is the Champion
          </h1>
          <p className="text-xl text-gray-600">
            Final Score: {winner.score} points
          </p>
        </div>
      )}

      {/* Final Standings */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Final Standings</h2>
        <MasterLeaderboard rankings={finalLeaderboard} />
      </div>

      {/* Segment Winners Summary */}
      {segmentWinners.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Segment Winners</h3>
          <div className="space-y-2">
            {segmentWinners.map((sw, idx) => (
              <div key={sw.segment_id} className="flex justify-between p-2 bg-gray-50 rounded">
                <span>{sw.segment_title || `Segment ${idx + 1}`}</span>
                <span className="font-medium">{sw.winner_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

