import { Trophy, Medal, Award, Clock, Info } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'
import { Tooltip } from '@/components/common/Tooltip'

interface MasterLeaderboardProps {
  rankings: LeaderboardEntry[]
  segmentsPlayed?: Record<string, number>
  showTieTooltip?: boolean
}

export function MasterLeaderboard({
  rankings,
  segmentsPlayed,
  showTieTooltip = true,
}: MasterLeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" data-testid="trophy-icon" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" data-testid="medal-icon" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" data-testid="award-icon" />
      default:
        return <span className="text-gray-400 font-semibold">{rank}</span>
    }
  }

  const getTieTooltip = (index: number) => {
    if (!showTieTooltip || index === 0) return null
    const prev = rankings[index - 1]
    const current = rankings[index]
    if (!prev || prev.score !== current.score) return null
    if (prev.response_time_ms == null || current.response_time_ms == null) {
      return 'Faster response time'
    }
    const delta = Math.max(prev.response_time_ms - current.response_time_ms, 0)
    return delta > 0 ? `Faster response time (${delta} ms faster)` : 'Faster response time'
  }

  return (
    <div className="bg-dark-900 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-2">🏆 Master Leaderboard</h2>
      <p className="text-gray-400 mb-4">Aggregate scores across all segments</p>

      <div className="flex items-start gap-2 mb-6 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" data-testid="info-icon" />
        <div className="text-xs text-gray-300">
          <span className="font-semibold text-cyan-400">Tie-breaker:</span> Players with equal scores are ranked by total response time (faster cumulative time wins)
        </div>
      </div>

      <div className="space-y-3">
        {rankings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-gray-400 font-medium mb-1">No participants yet</p>
            <p className="text-gray-500 text-sm">Participants will appear here once they join</p>
          </div>
        ) : rankings.every(r => r.score === 0) ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🤝</div>
            <p className="text-gray-300 font-medium mb-2">Everyone's learning together!</p>
            <p className="text-gray-400 text-sm mb-4">No points scored yet, but that's part of the journey</p>
            <div className="space-y-3">
              {rankings.map((entry, index) => {
                const tieTooltip = getTieTooltip(index)
                return (
                <div
                  key={entry.user_id}
                  className="flex items-center gap-4 p-3 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 transition-colors"
                >
                  <div className="w-8 flex items-center justify-center">
                    <span className="text-gray-400 text-sm">{entry.rank}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.username}
                        className="w-8 h-8 rounded-full opacity-75"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent-cyan/10 flex items-center justify-center">
                        <span className="text-accent-cyan/70 font-semibold text-sm">
                          {entry.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 text-sm">{entry.username}</span>
                        {tieTooltip && (
                          <Tooltip content={tieTooltip} position="top">
                            <Info
                              className="w-3 h-3 text-cyan-400/70"
                              data-testid={`tie-tooltip-${entry.user_id}`}
                            />
                          </Tooltip>
                        )}
                        {entry.is_late_joiner && (
                          <span className="inline-flex items-center gap-1 px-1 py-0.5 bg-amber-500/10 text-amber-400/70 text-xs rounded" title="Joined after quiz started">
                            <Clock className="w-2.5 h-2.5" />
                            Late
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">0 points</div>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          rankings.map((entry, index) => {
            const tieTooltip = getTieTooltip(index)
            return (
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{entry.username}</span>
                    {tieTooltip && (
                      <Tooltip content={tieTooltip} position="top">
                        <Info
                          className="w-4 h-4 text-cyan-400"
                          data-testid={`tie-tooltip-${entry.user_id}`}
                        />
                      </Tooltip>
                    )}
                    {entry.is_late_joiner && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded" title="Joined after quiz started">
                        <Clock className="w-3 h-3" />
                        Late
                      </span>
                    )}
                  </div>
                  {segmentsPlayed && segmentsPlayed[entry.user_id] && (
                    <div className="text-xs text-gray-400">
                      {segmentsPlayed[entry.user_id]} segments played
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-accent-cyan">{entry.score}</div>
                <div className="text-xs text-gray-400">total points</div>
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}

