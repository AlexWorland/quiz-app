import { Star, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import type { Question } from '@/api/endpoints'

interface GeneratedQuestionListProps {
  questions: Question[]
  onEdit?: (questionId: string) => void
  onDelete?: (questionId: string) => void
  qualityThreshold?: number
  showQualityFilter?: boolean
}

export function GeneratedQuestionList({
  questions,
  onEdit,
  onDelete,
  qualityThreshold = 0.6,
  showQualityFilter = true,
}: GeneratedQuestionListProps) {
  const [filterByQuality, setFilterByQuality] = useState(false)

  const renderStars = (score: number | null | undefined) => {
    if (!score) return null
    const stars = Math.round(score * 5)
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
            }`}
          />
        ))}
      </div>
    )
  }

  const getQualityColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-500'
    if (score >= 0.8) return 'text-green-400'
    if (score >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const filteredQuestions = filterByQuality
    ? questions.filter((q) => (q.quality_score ?? 0) >= qualityThreshold)
    : questions

  return (
    <div className="space-y-3">
      {showQualityFilter && questions.length > 0 && (
        <div className="flex items-center gap-4 mb-4 p-3 bg-dark-800 rounded-lg">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterByQuality}
              onChange={(e) => setFilterByQuality(e.target.checked)}
              className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-accent-cyan focus:ring-accent-cyan"
            />
            <span>Show only quality questions (≥{Math.round(qualityThreshold * 100)}%)</span>
          </label>
          <div className="text-xs text-gray-500">
            Showing {filteredQuestions.length} of {questions.length} questions
          </div>
        </div>
      )}

      {filteredQuestions.length === 0 ? (
        <p className="text-gray-500 italic">
          {questions.length === 0
            ? 'No questions generated yet.'
            : `No questions meet the quality threshold (≥${Math.round(qualityThreshold * 100)}%).`}
        </p>
      ) : (
        filteredQuestions.map((q) => (
          <div
            key={q.id}
            className="bg-dark-800 rounded-lg p-4 border border-dark-700 hover:border-dark-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-400">
                    Question {q.order_index + 1}
                  </span>
                  {renderStars(q.quality_score)}
                  {q.quality_score !== null && q.quality_score !== undefined && (
                    <span
                      className={`text-xs font-semibold ${getQualityColor(q.quality_score)}`}
                    >
                      {(q.quality_score * 100).toFixed(0)}%
                    </span>
                  )}
                  {q.quality_score !== null &&
                    q.quality_score !== undefined &&
                    q.quality_score < qualityThreshold && (
                      <div className="flex items-center gap-1 text-xs text-yellow-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Below threshold</span>
                      </div>
                    )}
                </div>
                <p className="text-white font-medium mb-2">{q.question_text}</p>
                <p className="text-sm text-gray-400">
                  <span className="font-medium">Answer:</span> {q.correct_answer}
                </p>
                {q.source_transcript && (
                  <p className="text-xs text-gray-500 mt-2 italic">
                    Source: "{q.source_transcript.substring(0, 100)}..."
                  </p>
                )}
              </div>
              {(onEdit || onDelete) && (
                <div className="flex gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(q.id)}
                      className="text-accent-cyan hover:text-accent-cyan-light text-sm"
                    >
                      Edit
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(q.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

