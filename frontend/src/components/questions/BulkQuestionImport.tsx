import { useState } from 'react'
import Papa from 'papaparse'
import { Button } from '../common/Button'
import { bulkImportQuestions } from '@/api/endpoints'

interface BulkQuestionImportProps {
  segmentId: string
  onQuestionsImported: (count: number) => void
}

interface ParsedQuestion {
  question_text: string
  correct_answer: string
}

interface ImportResult {
  total: number
  imported: number
  failed: number
}

type TabType = 'csv' | 'json'

export function BulkQuestionImport({ segmentId, onQuestionsImported }: BulkQuestionImportProps) {
  const [activeTab, setActiveTab] = useState<TabType>('csv')
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [jsonText, setJsonText] = useState('')
  const [jsonQuestions, setJsonQuestions] = useState<ParsedQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setParsedQuestions([])

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const questions: ParsedQuestion[] = []
        const errors: string[] = []

        results.data.forEach((row, index) => {
          const questionText = row.question_text?.trim()
          const correctAnswer = row.correct_answer?.trim()

          if (!questionText || !correctAnswer) {
            errors.push(`Row ${index + 1}: Missing question_text or correct_answer`)
          } else {
            questions.push({
              question_text: questionText,
              correct_answer: correctAnswer,
            })
          }
        })

        if (errors.length > 0) {
          setError(`CSV parsing errors:\n${errors.join('\n')}`)
        } else if (questions.length === 0) {
          setError('No valid questions found in CSV')
        } else {
          setParsedQuestions(questions)
        }
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`)
      },
    })
  }

  const handleJsonPaste = () => {
    try {
      setError(null)
      setJsonQuestions([])

      const parsed = JSON.parse(jsonText)

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error('JSON must contain a "questions" array')
      }

      const questions: ParsedQuestion[] = []
      const errors: string[] = []

      parsed.questions.forEach((q: any, index: number) => {
        if (!q.question_text || typeof q.question_text !== 'string') {
          errors.push(`Question ${index + 1}: Missing or invalid question_text`)
        } else if (!q.correct_answer || typeof q.correct_answer !== 'string') {
          errors.push(`Question ${index + 1}: Missing or invalid correct_answer`)
        } else {
          questions.push({
            question_text: q.question_text.trim(),
            correct_answer: q.correct_answer.trim(),
          })
        }
      })

      if (errors.length > 0) {
        setError(`JSON validation errors:\n${errors.join('\n')}`)
      } else if (questions.length === 0) {
        setError('No valid questions found in JSON')
      } else {
        setJsonQuestions(questions)
      }
    } catch (err) {
      setError(`Invalid JSON: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleImport = async () => {
    const questionsToImport = activeTab === 'csv' ? parsedQuestions : jsonQuestions
    if (questionsToImport.length === 0) return

    setIsImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const response = await bulkImportQuestions(segmentId, { questions: questionsToImport })
      const result: ImportResult = {
        total: questionsToImport.length,
        imported: response.data.imported,
        failed: response.data.failed,
      }
      setImportResult(result)

      if (result.failed === 0) {
        onQuestionsImported(result.imported)
        // Reset state
        setParsedQuestions([])
        setJsonText('')
        setJsonQuestions([])
      }
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsImporting(false)
    }
  }

  const currentQuestions = activeTab === 'csv' ? parsedQuestions : jsonQuestions
  const canImport = currentQuestions.length > 0 && !isImporting

  return (
    <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
      <h3 className="text-xl font-semibold text-white mb-4">Bulk Import Questions</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-dark-700">
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'csv'
              ? 'text-accent-cyan border-b-2 border-accent-cyan'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          CSV Upload
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'json'
              ? 'text-accent-cyan border-b-2 border-accent-cyan'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          JSON Paste
        </button>
      </div>

      {/* CSV Tab */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileChange}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent-cyan file:text-dark-900 hover:file:bg-opacity-90 file:cursor-pointer"
            />
          </div>

          <div className="bg-dark-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Expected CSV Format:</h4>
            <pre className="text-xs text-gray-400 overflow-x-auto">
              {`question_text,correct_answer
"What is the capital of France?","Paris"
"What is 2 + 2?","4"
"What is the largest planet?","Jupiter"`}
            </pre>
          </div>

          {parsedQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Preview ({parsedQuestions.length} questions)
              </h4>
              <div className="bg-dark-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-dark-800 text-gray-300">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Question</th>
                      <th className="px-4 py-2 text-left">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    {parsedQuestions.slice(0, 5).map((q, i) => (
                      <tr key={i} className="border-t border-dark-800">
                        <td className="px-4 py-2">{i + 1}</td>
                        <td className="px-4 py-2">{q.question_text}</td>
                        <td className="px-4 py-2">{q.correct_answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedQuestions.length > 5 && (
                  <div className="px-4 py-2 text-xs text-gray-500 bg-dark-800 border-t border-dark-700">
                    Showing 5 of {parsedQuestions.length} questions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* JSON Tab */}
      {activeTab === 'json' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              JSON Data
            </label>
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{"questions": [{"question_text": "...", "correct_answer": "..."}]}'
              className="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-white focus:outline-none focus:border-accent-cyan font-mono text-sm"
              rows={10}
            />
          </div>

          <Button onClick={handleJsonPaste} variant="secondary" size="sm">
            Validate JSON
          </Button>

          <div className="bg-dark-900 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Expected JSON Format:</h4>
            <pre className="text-xs text-gray-400 overflow-x-auto">
              {`{
  "questions": [
    {
      "question_text": "What is the capital of France?",
      "correct_answer": "Paris"
    },
    {
      "question_text": "What is 2 + 2?",
      "correct_answer": "4"
    }
  ]
}`}
            </pre>
          </div>

          {jsonQuestions.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                Preview ({jsonQuestions.length} questions)
              </h4>
              <div className="bg-dark-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-dark-800 text-gray-300">
                    <tr>
                      <th className="px-4 py-2 text-left">#</th>
                      <th className="px-4 py-2 text-left">Question</th>
                      <th className="px-4 py-2 text-left">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    {jsonQuestions.slice(0, 5).map((q, i) => (
                      <tr key={i} className="border-t border-dark-800">
                        <td className="px-4 py-2">{i + 1}</td>
                        <td className="px-4 py-2">{q.question_text}</td>
                        <td className="px-4 py-2">{q.correct_answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {jsonQuestions.length > 5 && (
                  <div className="px-4 py-2 text-xs text-gray-500 bg-dark-800 border-t border-dark-700">
                    Showing 5 of {jsonQuestions.length} questions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-4 mt-4">
          <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className={`rounded-lg p-4 mt-4 ${
          importResult.failed === 0
            ? 'bg-green-900 bg-opacity-20 border border-green-500'
            : 'bg-yellow-900 bg-opacity-20 border border-yellow-500'
        }`}>
          <p className={`text-sm ${importResult.failed === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
            Import complete: {importResult.imported} of {importResult.total} questions imported
            {importResult.failed > 0 && `, ${importResult.failed} failed`}
          </p>
        </div>
      )}

      {/* Import Button */}
      <div className="flex justify-end mt-6">
        <Button
          onClick={handleImport}
          disabled={!canImport}
          loading={isImporting}
          variant="primary"
        >
          Import {currentQuestions.length > 0 && `(${currentQuestions.length} questions)`}
        </Button>
      </div>
    </div>
  )
}
