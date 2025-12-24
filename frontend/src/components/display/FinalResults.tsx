import { motion } from 'framer-motion'
import { Trophy, Award, Medal, Clock, Info, User } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'
import { Tooltip } from '@/components/common/Tooltip'

interface FinalResultsProps {
  rankings: LeaderboardEntry[]
  totalQuestions: number
  eventTitle?: string
}

export function FinalResults({ rankings, totalQuestions, eventTitle }: FinalResultsProps) {
  const winner = rankings[0]
  const topThree = rankings.slice(0, 3)
  const allZeroScores = rankings.length > 0 && rankings.every(r => r.score === 0)

  const getTieTooltip = (index: number, rankedList: LeaderboardEntry[]) => {
    if (index === 0) return null
    const prev = rankedList[index - 1]
    const current = rankedList[index]
    if (!prev || prev.score !== current.score) return null
    if (prev.response_time_ms == null || current.response_time_ms == null) {
      return 'Faster response time'
    }
    const delta = Math.max(prev.response_time_ms - current.response_time_ms, 0)
    return delta > 0 ? `Faster response time (${delta} ms faster)` : 'Faster response time'
  }

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

        {/* Winner Celebration or Participation Awards */}
        {allZeroScores ? (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
            className="text-center mb-12"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              className="text-8xl mb-4"
            >
              🎊
            </motion.div>
            <h2 className="text-4xl font-bold mb-2">Everyone's a Participant!</h2>
            <p className="text-xl text-gray-300 mb-6">
              Learning is the real victory! Thanks for participating in this challenging quiz.
            </p>
            
            {/* Participation Awards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {rankings.slice(0, 8).map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-lg p-4 border border-purple-300/30"
                >
                  <div className="text-3xl mb-2">🏅</div>
                  {entry.avatar_url ? (
                    <img
                      src={entry.avatar_url}
                      alt={entry.username}
                      className="w-12 h-12 rounded-full mx-auto mb-2 ring-2 ring-purple-300/50"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold mx-auto mb-2 ring-2 ring-purple-300/50">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-white font-semibold text-sm">{entry.username}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {entry.is_late_joiner && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-xs rounded">
                        <Clock className="w-3 h-3" />
                        Late Join
                      </span>
                    )}
                    {entry.is_present === false && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-500/20 text-gray-300 text-xs rounded">
                        <User className="w-3 h-3" />
                        Not Present
                      </span>
                    )}
                  </div>
                  <div className="text-purple-300 text-xs mt-1">Participant</div>
                </motion.div>
              ))}
            </div>
            
            {rankings.length > 8 && (
              <p className="text-gray-400 text-sm mt-4">
                + {rankings.length - 8} more participants
              </p>
            )}
          </motion.div>
        ) : winner ? (
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
                <div className="flex items-center gap-2">
                  <div className="text-3xl font-bold">{winner.username}</div>
                  {getTieTooltip(0, rankings) && (
                    <Tooltip content={getTieTooltip(0, rankings)!} position="top">
                      <Info className="w-5 h-5 text-cyan-400" />
                    </Tooltip>
                  )}
                  <div className="flex items-center gap-2">
                    {winner.is_late_joiner && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-sm rounded" title="Joined after quiz started">
                        <Clock className="w-4 h-4" />
                        Late
                      </span>
                    )}
                    {winner.is_present === false && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/20 text-gray-300 text-sm rounded" title="Left before results">
                        <User className="w-4 h-4" />
                        Not Present
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-2xl text-yellow-300">{winner.score} points</div>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* Top Three Podium */}
        {!allZeroScores && topThree.length > 0 && (
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
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1">
                          <div className="text-white font-bold text-lg text-center">{entry.username}</div>
                          {getTieTooltip(index, topThree) && (
                            <Tooltip content={getTieTooltip(index, topThree)!} position="top">
                              <Info className="w-4 h-4 text-cyan-400" />
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {entry.is_late_joiner && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/30 text-amber-200 text-xs rounded" title="Joined after quiz started">
                              <Clock className="w-3 h-3" />
                              Late
                            </span>
                          )}
                          {entry.is_present === false && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-500/30 text-gray-200 text-xs rounded" title="Left before results">
                              <User className="w-3 h-3" />
                              Absent
                            </span>
                          )}
                        </div>
                      </div>
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
                  <div className="flex-1 flex items-center gap-2">
                    <span className="font-semibold">{entry.username}</span>
                    {getTieTooltip(index + 3, rankings) && (
                      <Tooltip content={getTieTooltip(index + 3, rankings)!} position="top">
                        <Info className="w-4 h-4 text-cyan-400" />
                      </Tooltip>
                    )}
                    <div className="flex items-center gap-2">
                      {entry.is_late_joiner && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded" title="Joined after quiz started">
                          <Clock className="w-3 h-3" />
                          Late
                        </span>
                      )}
                      {entry.is_present === false && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-500/20 text-gray-300 text-xs rounded" title="Left before results">
                          <User className="w-3 h-3" />
                          Absent
                        </span>
                      )}
                    </div>
                  </div>
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

