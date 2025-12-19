import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Medal, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface AnimatedLeaderboardProps {
  rankings: LeaderboardEntry[]
  previousRankings?: LeaderboardEntry[]
  highlightTop?: number
  showRankChanges?: boolean
}

export function AnimatedLeaderboard({
  rankings,
  previousRankings = [],
  highlightTop = 3,
  showRankChanges = true,
}: AnimatedLeaderboardProps) {
  const getRankChange = (userId: string, currentRank: number): number | null => {
    if (!previousRankings.length) return null
    const previous = previousRankings.find((r) => r.user_id === userId)
    if (!previous) return null
    return previous.rank - currentRank // Positive = moved up, negative = moved down
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />
      case 2:
        return <Medal className="w-8 h-8 text-gray-300" />
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />
      default:
        return <span className="text-gray-400 font-bold text-xl">{rank}</span>
    }
  }

  const getRankChangeIcon = (change: number | null) => {
    if (change === null) return <Minus className="w-4 h-4 text-gray-500" />
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  return (
    <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg p-8 min-h-screen flex flex-col">
      <h2 className="text-4xl font-bold text-white mb-8 text-center">Leaderboard</h2>
      <div className="space-y-4 flex-1">
        <AnimatePresence>
          {rankings.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-300 text-center py-8 text-xl"
            >
              No scores yet
            </motion.p>
          ) : (
            rankings.map((entry, index) => {
              const rankChange = showRankChanges ? getRankChange(entry.user_id, entry.rank) : null
              const isTopThree = entry.rank <= highlightTop

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  className={`flex items-center gap-6 p-6 rounded-lg transition-all ${
                    isTopThree
                      ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-400/50 shadow-lg shadow-yellow-400/20'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-16 flex items-center justify-center">
                    {getRankIcon(entry.rank)}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt={entry.username}
                        className={`rounded-full ${isTopThree ? 'w-16 h-16 ring-4 ring-yellow-400/50' : 'w-12 h-12'}`}
                      />
                    ) : (
                      <div
                        className={`rounded-full flex items-center justify-center font-bold text-white ${
                          isTopThree ? 'w-16 h-16 text-2xl bg-gradient-to-br from-purple-500 to-blue-500' : 'w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400'
                        }`}
                      >
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Username and Score */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3
                        className={`font-bold ${isTopThree ? 'text-2xl text-white' : 'text-xl text-gray-100'}`}
                      >
                        {entry.username}
                      </h3>
                      {showRankChanges && rankChange !== null && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`flex items-center gap-1 ${
                            rankChange > 0 ? 'text-green-400' : rankChange < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}
                        >
                          {getRankChangeIcon(rankChange)}
                          <span className="text-sm font-semibold">
                            {rankChange > 0 ? `+${rankChange}` : rankChange}
                          </span>
                        </motion.div>
                      )}
                    </div>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                      className="mt-2"
                    >
                      <div className={`font-bold ${isTopThree ? 'text-3xl text-yellow-300' : 'text-2xl text-white'}`}>
                        {entry.score} pts
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

