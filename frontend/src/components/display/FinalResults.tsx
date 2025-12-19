import { motion } from 'framer-motion'
import { Trophy, Award, Medal } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface FinalResultsProps {
  rankings: LeaderboardEntry[]
  totalQuestions: number
  eventTitle?: string
}

export function FinalResults({ rankings, totalQuestions, eventTitle }: FinalResultsProps) {
  const winner = rankings[0]
  const topThree = rankings.slice(0, 3)

  return (
    <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 min-h-screen flex flex-col items-center justify-center p-8 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full"
      >
        {/* Event Title */}
        {eventTitle && (
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold text-center mb-8"
          >
            {eventTitle}
          </motion.h1>
        )}

        {/* Winner Celebration */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
            className="text-center mb-12"
          >
            <motion.div
              animate={{
                rotate: [0, 10, -10, 10, -10, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2,
              }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-4xl font-bold mb-2">Winner!</h2>
            <div className="flex items-center justify-center gap-4 mb-4">
              {winner.avatar_url ? (
                <img
                  src={winner.avatar_url}
                  alt={winner.username}
                  className="w-20 h-20 rounded-full ring-4 ring-yellow-400"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-3xl font-bold ring-4 ring-yellow-400">
                  {winner.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="text-3xl font-bold">{winner.username}</div>
                <div className="text-2xl text-yellow-300">{winner.score} points</div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Top Three Podium */}
        {topThree.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mb-12"
          >
            <h3 className="text-3xl font-bold text-center mb-6">Top 3</h3>
            <div className="flex items-end justify-center gap-4">
              {topThree.map((entry, index) => {
                const heights = [200, 150, 120]
                const icons = [
                  <Trophy className="w-8 h-8 text-yellow-400" />,
                  <Medal className="w-8 h-8 text-gray-300" />,
                  <Award className="w-8 h-8 text-amber-600" />,
                ]
                const colors = [
                  'from-yellow-400 to-amber-500',
                  'from-gray-300 to-gray-400',
                  'from-amber-600 to-orange-600',
                ]

                return (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.1 }}
                    className="flex flex-col items-center"
                  >
                    <div className="mb-2">{icons[index]}</div>
                    <motion.div
                      className={`w-32 bg-gradient-to-t ${colors[index]} rounded-t-lg flex flex-col items-center justify-end p-4 shadow-lg`}
                      style={{ height: `${heights[index]}px` }}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8 + index * 0.1, type: 'spring', stiffness: 200 }}
                    >
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt={entry.username}
                          className="w-16 h-16 rounded-full mb-2 ring-2 ring-white/50"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold mb-2 ring-2 ring-white/50">
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-white font-bold text-lg">{entry.username}</div>
                      <div className="text-white/90 text-sm">{entry.score} pts</div>
                    </motion.div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Full Leaderboard */}
        {rankings.length > 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="bg-white/10 rounded-lg p-6"
          >
            <h3 className="text-2xl font-bold mb-4 text-center">Full Leaderboard</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {rankings.slice(3).map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + index * 0.05 }}
                  className="flex items-center gap-4 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <span className="text-gray-400 font-semibold w-8">{entry.rank}</span>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.username}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center font-semibold">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 font-semibold">{entry.username}</div>
                  <div className="text-yellow-300 font-bold">{entry.score} pts</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-8 text-center text-gray-300"
        >
          <p className="text-xl">
            {totalQuestions > 0 && `Completed ${totalQuestions} questions`}
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

