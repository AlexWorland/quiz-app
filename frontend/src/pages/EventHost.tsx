import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/common/Button'
import { PassPresenterButton } from '@/components/quiz/PassPresenterButton'
import { AnswerProgress } from '@/components/quiz/AnswerProgress'
import { PresenterControls } from '@/components/quiz/PresenterControls'
import { SegmentCompleteView } from '@/components/quiz/SegmentCompleteView'
import { RecordingControls } from '@/components/recording/RecordingControls'
import { RecordingStatus } from '@/components/recording/RecordingStatus'
import { TranscriptView } from '@/components/recording/TranscriptView'
import { GeneratedQuestionList } from '@/components/questions/GeneratedQuestionList'
import { QuizReadyIndicator } from '@/components/questions/QuizReadyIndicator'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import { QuestionCreator } from '@/components/questions/QuestionCreator'
import { BulkQuestionImport } from '@/components/questions/BulkQuestionImport'
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
  getSegment,
} from '@/api/endpoints'
import { useAudioWebSocket, type AudioServerMessage } from '@/hooks/useAudioWebSocket'
import { useEventWebSocket, type ServerMessage, type Participant, type QuizPhase, type LeaderboardEntry as WsLeaderboardEntry, type SegmentWinner } from '@/hooks/useEventWebSocket'
import { DisplayModeContainer } from '@/components/display/DisplayModeContainer'

export function EventHostPage() {
  const { eventId, segmentId } = useParams<{ eventId: string; segmentId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

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
  const [participants, setParticipants] = useState<Participant[]>([])

  // Tab state for Traditional Mode
  const [activeTab, setActiveTab] = useState<'add' | 'import' | 'list'>('add')

  // Display mode state
  const [processingStatus, setProcessingStatus] = useState<{
    step: 'transcribing' | 'generating' | 'ready'
    progress?: number
    message: string
  } | null>(null)
  const [previousRankings, setPreviousRankings] = useState<LeaderboardEntry[]>([])

  // Quiz phase state for enhanced message handling
  const [quizPhase, setQuizPhase] = useState<QuizPhase>('not_started')
  const [allAnswered, setAllAnswered] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [currentPresenterName, setCurrentPresenterName] = useState<string | null>(null)
  const [_segmentComplete, setSegmentComplete] = useState<{
    segment_id: string
    segment_title: string
    presenter_name: string
    segment_leaderboard: WsLeaderboardEntry[]
    event_leaderboard: WsLeaderboardEntry[]
    segment_winner?: WsLeaderboardEntry
    event_leader?: WsLeaderboardEntry
  } | null>(null)
  const [_eventComplete, setEventComplete] = useState<{
    event_id: string
    final_leaderboard: WsLeaderboardEntry[]
    winner?: WsLeaderboardEntry
    segment_winners: SegmentWinner[]
  } | null>(null)

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

      // Fetch the specific segment using the dedicated endpoint
      const segmentRes = await getSegment(eventId, segmentId)
      setSegment(segmentRes.data)

      setQuestions(segmentQuestions.data)
    } catch (error) {
      console.error('Failed to load host view:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  // Audio WebSocket for live transcription & question generation
  const {
    startRecording: startAudioCapture,
    stopRecording: stopAudioCapture,
    audioCapabilities,
    audioError,
  } = useAudioWebSocket({
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
      } else if (msg.type === 'reveal') {
        // Reveal handled by phase change
      } else if (msg.type === 'leaderboard') {
        setPreviousRankings(segmentRankings)
        setSegmentRankings(msg.rankings)
      } else if (msg.type === 'game_ended') {
        setIsQuizActive(false)
      } else if (msg.type === 'processing_status') {
        setProcessingStatus({
          step: msg.step as 'transcribing' | 'generating' | 'ready',
          progress: msg.progress,
          message: msg.message,
        })
      } else if (msg.type === 'phase_changed') {
        setQuizPhase(msg.phase)
        setCurrentQuestionIndex(msg.question_index)
        // Reset allAnswered when moving to a new question
        if (msg.phase === 'showing_question') {
          setAllAnswered(false)
          setAnsweredCount(0)
        }
      } else if (msg.type === 'all_answered') {
        setAllAnswered(true)
        setAnsweredCount(msg.answer_count)
      } else if (msg.type === 'answer_received') {
        setAnsweredCount((prev) => prev + 1)
      } else if (msg.type === 'presenter_changed') {
        setCurrentPresenterName(msg.new_presenter_name)

        // If I was the presenter and now I'm not, reset my state
        if (user && msg.previous_presenter_id === user.id) {
          setSegmentComplete(null)
          // Optionally navigate to participant view
          // navigate(`/events/${eventId}/participate/${msg.segment_id}`)
        }
      } else if (msg.type === 'segment_complete') {
        setSegmentComplete({
          segment_id: msg.segment_id,
          segment_title: msg.segment_title,
          presenter_name: msg.presenter_name,
          segment_leaderboard: msg.segment_leaderboard,
          event_leaderboard: msg.event_leaderboard,
          segment_winner: msg.segment_winner,
          event_leader: msg.event_leader,
        })
        setIsQuizActive(false)
      } else if (msg.type === 'event_complete') {
        setEventComplete({
          event_id: msg.event_id,
          final_leaderboard: msg.final_leaderboard,
          winner: msg.winner,
          segment_winners: msg.segment_winners,
        })
        setIsQuizActive(false)
      }
    },
  })

  // Host control handlers
  const handleStartQuiz = () => {
    sendMessage({ type: 'start_game' })
  }

  const handleNextQuestion = () => {
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

  const handleQuestionAdded = async () => {
    if (segmentId) {
      const res = await getSegmentQuestions(segmentId)
      setQuestions(res.data)
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

  // Show processing screen when processing status is active
  if (processingStatus) {
    return (
      <DisplayModeContainer
        processingStatus={processingStatus}
        rankings={segmentRankings}
        previousRankings={previousRankings}
      />
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
            {currentPresenterName && (
              <div className="text-sm text-cyan-400 mt-1">
                Current Presenter: {currentPresenterName}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 mb-1">Join Code</div>
            <div className="text-2xl font-mono font-bold text-cyan-400">{event.join_code}</div>
          </div>
        </div>

        {/* Listen-Only Mode: Recording status + controls */}
        {event.mode === 'listen_only' && (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr] gap-6">
            <div className="bg-dark-900 rounded-lg p-6 border border-dark-700 space-y-4">
              <h2 className="text-lg font-semibold text-white mb-2">Recording Status</h2>
              {/* Audio capability warnings */}
              {audioError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm mb-4">
                  ⚠️ {audioError}
                </div>
              )}
              {audioCapabilities && !audioCapabilities.isOptimal && audioCapabilities.warning && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 text-yellow-400 text-sm mb-4">
                  ⚠️ {audioCapabilities.warning}
                </div>
              )}
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
        )}

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

          {/* Use PresenterControls for quiz flow */}
          {isQuizActive && quizPhase !== 'segment_complete' && quizPhase !== 'event_complete' ? (
            <PresenterControls
              phase={quizPhase}
              questionIndex={currentQuestionIndex}
              totalQuestions={questions.length}
              allAnswered={allAnswered}
              onRevealAnswer={handleRevealAnswer}
              onShowLeaderboard={handleShowLeaderboard}
              onNextQuestion={handleNextQuestion}
              onEndQuiz={handleEndQuiz}
            />
          ) : !isQuizActive ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={handleStartQuiz}
                disabled={questions.length === 0 || !isConnected}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Quiz ({questions.length} questions)
              </Button>
            </div>
          ) : null}

          {/* Show answer progress when showing question */}
          {isQuizActive && quizPhase === 'showing_question' && (
            <div className="mt-4">
              <AnswerProgress
                answeredCount={answeredCount}
                totalParticipants={participants.length}
                allAnswered={allAnswered}
              />
            </div>
          )}

          {/* Show segment complete view */}
          {_segmentComplete && (
            <div className="mt-4">
              <SegmentCompleteView
                segmentTitle={_segmentComplete.segment_title}
                segmentLeaderboard={_segmentComplete.segment_leaderboard}
                eventLeaderboard={_segmentComplete.event_leaderboard}
                segmentWinner={_segmentComplete.segment_winner}
                isPresenter={true}
                onPassPresenter={() => {
                  // Pass presenter button is handled inside SegmentCompleteView
                }}
              />
              <div className="mt-4">
                <PassPresenterButton
                  participants={participants.map(p => ({ id: p.id, username: p.username, avatar_url: p.avatar_url }))}
                  currentUserId={user?.id || ''}
                  onPass={(nextPresenterId) => {
                    sendMessage({ type: 'pass_presenter', next_presenter_user_id: nextPresenterId })
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Questions + leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr] gap-6 items-start">
          <div className="space-y-4">
            {/* Traditional Mode: Tabbed Question Management */}
            {event.mode === 'normal' ? (
              <>
                <div className="bg-dark-900 rounded-lg border border-dark-700 overflow-hidden">
                  {/* Tab Headers */}
                  <div className="flex border-b border-dark-700">
                    <button
                      onClick={() => setActiveTab('add')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                        activeTab === 'add'
                          ? 'bg-dark-800 text-white border-b-2 border-cyan-500'
                          : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
                      }`}
                    >
                      Add Questions
                    </button>
                    <button
                      onClick={() => setActiveTab('import')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                        activeTab === 'import'
                          ? 'bg-dark-800 text-white border-b-2 border-cyan-500'
                          : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
                      }`}
                    >
                      Bulk Import
                    </button>
                    <button
                      onClick={() => setActiveTab('list')}
                      className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                        activeTab === 'list'
                          ? 'bg-dark-800 text-white border-b-2 border-cyan-500'
                          : 'text-gray-400 hover:text-white hover:bg-dark-800/50'
                      }`}
                    >
                      Question List ({questions.length})
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="p-6">
                    {activeTab === 'add' && (
                      <QuestionCreator segmentId={segment.id} onQuestionAdded={handleQuestionAdded} />
                    )}
                    {activeTab === 'import' && (
                      <BulkQuestionImport segmentId={segment.id} onQuestionsImported={handleQuestionAdded} />
                    )}
                    {activeTab === 'list' && (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-white">Questions</h3>
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
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Listen-Only Mode: Generated Questions */
              <>
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
              </>
            )}
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


