import { useState } from 'react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import { createQuestionForSegment, type CreateQuestionRequest } from '@/api/endpoints'

interface QuestionCreatorProps {
  segmentId: string
  onQuestionAdded?: () => void
}

export function QuestionCreator({ segmentId, onQuestionAdded }: QuestionCreatorProps) {
  const [questionText, setQuestionText] = useState('')
  const [correctAnswer, setCorrectAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!questionText.trim()) {
      setError('Question text is required')
      return
    }
    if (!correctAnswer.trim()) {
      setError('Correct answer is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data: CreateQuestionRequest = {
        question_text: questionText.trim(),
        correct_answer: correctAnswer.trim(),
      }

      await createQuestionForSegment(segmentId, data)

      // Clear form on success
      setQuestionText('')
      setCorrectAnswer('')

      // Notify parent component
      if (onQuestionAdded) {
        onQuestionAdded()
      }
    } catch (err) {
      console.error('Failed to create question:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to create question. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
      <h3 className="text-lg font-semibold text-white mb-4">Add New Question</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Question
          </label>
          <textarea
            value={questionText}
            onChange={(e) => {
              setQuestionText(e.target.value)
              setError(null)
            }}
            placeholder="Enter your question"
            className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-cyan focus:ring-2 focus:ring-accent-cyan/20 transition-all duration-200"
            rows={3}
            disabled={loading}
          />
        </div>

        <div>
          <Input
            label="Correct Answer"
            value={correctAnswer}
            onChange={(e) => {
              setCorrectAnswer(e.target.value)
              setError(null)
            }}
            placeholder="Enter the correct answer"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Adding Question' : 'Add Question'}
          </Button>
        </div>
      </form>
    </div>
  )
}
