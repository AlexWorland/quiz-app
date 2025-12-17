import { useState } from 'react'
import { Button } from '../common/Button'
import { Input } from '../common/Input'
import type { Question } from '@/api/endpoints'

interface QuestionEditorProps {
  question: Question
  onSave: (question: Partial<Question>) => void
  onCancel: () => void
}

export function QuestionEditor({ question, onSave, onCancel }: QuestionEditorProps) {
  const [questionText, setQuestionText] = useState(question.question_text)
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer)

  const handleSave = () => {
    onSave({
      question_text: questionText,
      correct_answer: correctAnswer,
    })
  }

  return (
    <div className="bg-dark-800 rounded-lg p-4 border border-accent-cyan">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Question
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white focus:outline-none focus:border-accent-cyan"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Correct Answer
          </label>
          <Input
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            placeholder="Enter correct answer"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary">
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

