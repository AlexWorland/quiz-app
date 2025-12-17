import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, SkipForward, Eye, Trophy, Square } from 'lucide-react'

import { Button } from '@/components/common/Button'
import { RecordingControls } from '@/components/recording/RecordingControls'
import { RecordingStatus } from '@/components/recording/RecordingStatus'
import { TranscriptView } from '@/components/recording/TranscriptView'
import { GeneratedQuestionList } from '@/components/questions/GeneratedQuestionList'
import { QuizReadyIndicator } from '@/components/questions/QuizReadyIndicator'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'

import {
  eventAPI,
  type Event,
  type Segment,
  type Question,
  type LeaderboardEntry,
  getSegmentQuestions,
  getSegmentLeaderboard,
  getMasterLeaderboard,
} from '@/api/endpoints'
import { useAudioWebSocket, type AudioServerMessage } from '@/hooks/useAudioWebSocket'
import { useEventWebSocket, type ServerMessage, type Participant } from '@/hooks/useEventWebSocket'

export function EventHostPage() {
  const { eventId, segmentId } = useParams<{ eventId: string; segmentId: string }>()
  const navigate = useNavigate()

  const [event, setEvent] = useState<Event | null>(null)
  const [segment, setSegment] = useState<Segment | null>(null)
  const [loading, setLoading] = useState(true)

  const [transcript, setTranscript] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [segmentRankings, setSegmentRankings] = useState<LeaderboardEntry[]>([])
  const [eventRankings, setEventRankings] = useState<LeaderboardEntry[]>([])

  // Quiz flow state
  const [isQuizActive, setIsQuizActive] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showingAnswer, setShowingAnswer] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])

  const qualityThreshold = 0.7

  const goodQuestionCount = useMemo(
    () =>
      questions.filter((q) => (q.quality_score ?? 0) > qualityThreshold).length,
    [questions]
  )

  useEffect(() => {
    if (!eventId || !segmentId) return
    void loadEventAndSegment()
  }, [eventId, segmentId])

  const loadEventAndSegment = async () => {
    if (!eventId || !segmentId) return
    try {
      setLoading(true)
      const [eventRes, segmentQuestions, segLb, evtLb] = await Promise.all([
        eventAPI.get(eventId),
        getSegmentQuestions(segmentId),
        getSegmentLeaderboard(segmentId),
        getMasterLeaderboard(eventId),
      ])

      setEvent(eventRes.data)
      setSegmentRankings(segLb.data)
      setEventRankings(evtLb.data)

      // We don't yet have a dedicated endpoint for a single segment,
      // so fetch all segments for the event and pick the one we need.
      const segmentsRes = await eventAPI.get(eventId)
      const segmentsList = (segmentsRes.data as Event & { segments?: Segment[] }).segments
      const foundSegment =
        segmentsList?.find((s) => s.id === segmentId) ?? null
      setSegment(foundSegment)

      setQuestions(segmentQuestions.data)
    } catch (error) {
      console.error('Failed to load host view:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  // Audio WebSocket for live transcription & question generation
  const { startRecording: startAudioCapture, stopRecording: stopAudioCapture } = useAudioWebSocket({
    segmentId: segmentId ?? '',
    onMessage: (msg: AudioServerMessage) => {
      if (msg.type === 'transcript_update') {
        setTranscript((prev) => (msg.is_final ? `${prev} ${msg.text}`.trim() : `${prev}\n${msg.text}`))
      } else if (msg.type === 'question_generated') {
        // When a new question is generated, refresh questions from the API
        if (segmentId) {
          void getSegmentQuestions(segmentId).then((res) => setQuestions(res.data))
        }
      }
    },
  })

  // Event WebSocket for quiz flow and participant tracking
  const { isConnected, sendMessage } = useEventWebSocket({
    eventId: eventId ?? '',
    onMessage: (msg: ServerMessage) => {
      if (msg.type === 'connected') {
        setParticipants(msg.participants)
      } else if (msg.type === 'participant_joined') {
        setParticipants((prev) => [...prev, msg.user])
      } else if (msg.type === 'participant_left') {
        setParticipants((prev) => prev.filter((p) => p.id !== msg.user_id))
      } else if (msg.type === 'game_started') {
        setIsQuizActive(true)
        setCurrentQuestionIndex(0)
        setShowingAnswer(false)
      } else if (msg.type === 'reveal') {
        setShowingAnswer(true)
      } else if (msg.type === 'leaderboard') {
        setSegmentRankings(msg.rankings)
      } else if (msg.type === 'game_ended') {
        setIsQuizActive(false)
        setShowingAnswer(false)
      }
    },
  })

  // Host control handlers
  const handleStartQuiz = () => {
    sendMessage({ type: 'start_game' })
  }

  const handleNextQuestion = () => {
    setShowingAnswer(false)
    setCurrentQuestionIndex((prev) => prev + 1)
    sendMessage({ type: 'next_question' })
  }

  const handleRevealAnswer = () => {
    sendMessage({ type: 'reveal_answer' })
  }

  const handleShowLeaderboard = () => {
    sendMessage({ type: 'show_leaderboard' })
  }

  const handleEndQuiz = () => {
    sendMessage({ type: 'end_game' })
  }

  const handleStartRecording = async () => {
    if (!segmentId) return
    try {
      const res = await eventAPI.startRecording(segmentId)
      setSegment(res.data)
      // Start capturing audio from microphone
      await startAudioCapture()
    } catch (error) {
      console.error('Failed to start recording:', error)
    }
  }

  const handlePauseRecording = async () => {
    if (!segmentId) return
    try {
      const res = await eventAPI.pauseRecording(segmentId)
      setSegment(res.data)
      // Stop audio capture while paused
      stopAudioCapture()
    } catch (error) {
      console.error('Failed to pause recording:', error)
    }
  }

  const handleResumeRecording = async () => {
    if (!segmentId) return
    try {
      const res = await eventAPI.resumeRecording(segmentId)
      setSegment(res.data)
      // Resume audio capture
      await startAudioCapture()
    } catch (error) {
      console.error('Failed to resume recording:', error)
    }
  }

  const handleStopRecording = async () => {
    if (!segmentId) return
    try {
      const res = await eventAPI.stopRecording(segmentId)
      setSegment(res.data)
      // Stop audio capture
      stopAudioCapture()
    } catch (error) {
      console.error('Failed to stop recording:', error)
    }
  }

  const handleRestartRecording = async () => {
    if (!segmentId) return
    try {
      // Stop any existing audio capture
      stopAudioCapture()
      const res = await eventAPI.restartRecording(segmentId)
      setSegment(res.data)
      setTranscript('')
      setQuestions([])
    } catch (error) {
      console.error('Failed to restart recording:', error)
    }
  }

  const handleEditQuestion = (questionId: string) => {
    setEditingQuestionId(questionId)
  }

  const handleSaveQuestion = async (questionId: string, partial: Partial<Question>) => {
    try {
      await eventAPI.updateQuestion(questionId, partial)
      if (segmentId) {
        const res = await getSegmentQuestions(segmentId)
        setQuestions(res.data)
      }
      setEditingQuestionId(null)
    } catch (error) {
      console.error('Failed to update question:', error)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return
    try {
      await eventAPI.deleteQuestion(questionId)
      setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    } catch (error) {
      console.error('Failed to delete question:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-gray-400">Loading host view...</div>
      </div>
    )
  }

  if (!event || !segment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-red-400">Event or segment not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
              Host: {event.title}
            </h1>
            <p className="text-gray-400 text-sm">
              Segment: <span className="font-semibold">{segment.title || segment.presenter_name}</span>
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">Join Code</div>
            <div className="text-2xl font-mono font-bold text-cyan-400">{event.join_code}</div>
          </div>
        </div>

        {/* Top row: recording status + controls */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr] gap-6">
          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-2">Recording Status</h2>
            <RecordingStatus status={segment.status} startedAt={segment.recording_started_at} />
            <RecordingControls
              status={segment.status}
              onStart={handleStartRecording}
              onPause={handlePauseRecording}
              onResume={handleResumeRecording}
              onStop={handleStopRecording}
              onRestart={handleRestartRecording}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Quiz Readiness</h2>
              <QuizReadyIndicator
                questionCount={questions.length}
                goodQuestionCount={goodQuestionCount}
                qualityThreshold={qualityThreshold}
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Live Transcript</h2>
              <TranscriptView transcript={transcript} isLive />
            </div>
          </div>
        </div>

        {/* Quiz Controls */}
        <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Quiz Controls</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm text-gray-400">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <span className="text-sm text-gray-400">
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isQuizActive ? (
              <Button
                variant="primary"
                onClick={handleStartQuiz}
                disabled={questions.length === 0 || !isConnected}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Quiz ({questions.length} questions)
              </Button>
            ) : (
              <>
                {!showingAnswer ? (
                  <Button
                    variant="primary"
                    onClick={handleRevealAnswer}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal Answer
                  </Button>
                ) : (
                  <>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button
                        variant="primary"
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        Next Question ({currentQuestionIndex + 2}/{questions.length})
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleShowLeaderboard}
                        className="flex items-center gap-2"
                      >
                        <Trophy className="w-4 h-4" />
                        Show Final Leaderboard
                      </Button>
                    )}
                  </>
                )}

                <Button
                  variant="secondary"
                  onClick={handleShowLeaderboard}
                  className="flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  Leaderboard
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleEndQuiz}
                  className="flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  End Quiz
                </Button>
              </>
            )}
          </div>

          {isQuizActive && (
            <div className="mt-4 text-sm text-gray-400">
              Question {currentQuestionIndex + 1} of {questions.length}
              {showingAnswer && ' - Answer revealed'}
            </div>
          )}
        </div>

        {/* Questions + leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr] gap-6 items-start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Generated Questions</h2>
              <Button
                variant="secondary"
                onClick={() => void getSegmentQuestions(segment.id).then((res) => setQuestions(res.data))}
              >
                Refresh
              </Button>
            </div>

            {editingQuestionId ? (
              (() => {
                const q = questions.find((question) => question.id === editingQuestionId)
                if (!q) return null
                return (
                  <QuestionEditor
                    question={q}
                    onSave={(partial) => handleSaveQuestion(q.id, partial)}
                    onCancel={() => setEditingQuestionId(null)}
                  />
                )
              })()
            ) : null}

            <GeneratedQuestionList
              questions={questions}
              onEdit={handleEditQuestion}
              onDelete={handleDeleteQuestion}
            />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Segment Leaderboard</h2>
              <SegmentLeaderboard rankings={segmentRankings} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Event Leaderboard</h2>
              <MasterLeaderboard rankings={eventRankings} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


