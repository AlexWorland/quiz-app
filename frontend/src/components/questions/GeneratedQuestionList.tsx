import { Star } from 'lucide-react'
import type { Question } from '@/api/endpoints'

interface GeneratedQuestionListProps {
  questions: Question[]
  onEdit?: (questionId: string) => void
  onDelete?: (questionId: string) => void
}

export function GeneratedQuestionList({
  questions,
  onEdit,
  onDelete,
}: GeneratedQuestionListProps) {
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

  return (
    <div className="space-y-3">
      {questions.length === 0 ? (
        <p className="text-gray-500 italic">No questions generated yet.</p>
      ) : (
        questions.map((q) => (
          <div
            key={q.id}
            className="bg-dark-800 rounded-lg p-4 border border-dark-700 hover:border-dark-600 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-400">
                    Question {q.order_index + 1}
                  </span>
                  {renderStars(q.quality_score)}
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

