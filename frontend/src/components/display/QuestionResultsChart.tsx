import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'

interface AnswerDistribution {
  answer: string
  count: number
  is_correct: boolean
}

interface QuestionResultsChartProps {
  distribution: AnswerDistribution[]
  correctAnswer: string
  totalParticipants: number
  averageResponseTime?: number
}

const COLORS = {
  correct: '#10b981', // green-500
  incorrect: '#ef4444', // red-500
}

export function QuestionResultsChart({
  distribution,
  correctAnswer,
  totalParticipants,
  averageResponseTime,
}: QuestionResultsChartProps) {
  const chartData = distribution.map((item) => ({
    answer: item.answer,
    count: item.count,
    percentage: totalParticipants > 0 ? Math.round((item.count / totalParticipants) * 100) : 0,
    is_correct: item.is_correct,
  }))

  return (
    <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-lg p-8 min-h-screen flex flex-col items-center justify-center text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <h2 className="text-4xl font-bold mb-8 text-center">Question Results</h2>

        {/* Chart */}
        <div className="bg-white/10 rounded-lg p-6 mb-6">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="answer"
                tick={{ fill: '#e5e7eb', fontSize: 14 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis tick={{ fill: '#e5e7eb', fontSize: 14 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                }}
                formatter={(value: number, _name: string, props: any) => [
                  `${value} (${props.payload.percentage}%)`,
                  'Responses',
                ]}
              />
              <Legend />
              <Bar dataKey="count" name="Responses" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.is_correct ? COLORS.correct : COLORS.incorrect}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 rounded-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-green-400 mb-2">
              {chartData.find((d) => d.is_correct)?.percentage || 0}%
            </div>
            <div className="text-gray-300">Got it right</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-white/10 rounded-lg p-6 text-center"
          >
            <div className="text-3xl font-bold text-white mb-2">{totalParticipants}</div>
            <div className="text-gray-300">Total participants</div>
          </motion.div>

          {averageResponseTime !== undefined && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="bg-white/10 rounded-lg p-6 text-center"
            >
              <div className="text-3xl font-bold text-blue-400 mb-2">
                {Math.round(averageResponseTime / 1000)}s
              </div>
              <div className="text-gray-300">Avg response time</div>
            </motion.div>
          )}
        </div>

        {/* Correct Answer Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-green-500/20 border-2 border-green-400 rounded-lg p-4 text-center"
        >
          <div className="text-sm text-gray-300 mb-1">Correct Answer</div>
          <div className="text-2xl font-bold text-green-400">{correctAnswer}</div>
        </motion.div>
      </motion.div>
    </div>
  )
}

