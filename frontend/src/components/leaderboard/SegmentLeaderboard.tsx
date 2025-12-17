import { Trophy, Medal, Award } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface SegmentLeaderboardProps {
  rankings: LeaderboardEntry[]
}

export function SegmentLeaderboard({ rankings }: SegmentLeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return <span className="text-gray-400 font-semibold">{rank}</span>
    }
  }

  return (
    <div className="bg-dark-900 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Segment Leaderboard</h2>
      <div className="space-y-3">
        {rankings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No scores yet</p>
        ) : (
          rankings.map((entry) => (
            <div
              key={entry.user_id}
              className="flex items-center gap-4 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
            >
              <div className="w-12 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 flex items-center gap-3">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center">
                    <span className="text-accent-cyan font-semibold">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white">{entry.username}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-accent-cyan">{entry.score}</div>
                <div className="text-xs text-gray-400">points</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

