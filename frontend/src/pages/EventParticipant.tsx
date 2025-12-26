import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Settings } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { ChangeDisplayName } from '@/components/event/ChangeDisplayName'
import { ReconnectionStatus } from '@/components/common/ReconnectionStatus'
import { QuestionDisplay } from '@/components/quiz/QuestionDisplay'
import { AnswerSelection } from '@/components/quiz/AnswerSelection'
import { QuizResults, type AnswerDistribution, type LeaderboardEntry as QuizLeaderboardEntry } from '@/components/quiz/QuizResults'
import { SegmentCompleteView } from '@/components/quiz/SegmentCompleteView'
import { EventCompleteView } from '@/components/quiz/EventCompleteView'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import { FlappyGame } from '@/components/flappy/FlappyGame'
import { FlappyBird } from '@/components/games/FlappyBird'
import { Button } from '@/components/common/Button'

import {
  getEvent,
  getSegmentLeaderboard,
  getMasterLeaderboard,
  updateParticipantDisplayName,
  type Event,
  type LeaderboardEntry,
} from '@/api/endpoints'
import {
  useEventWebSocket,
  type ServerMessage,
  type GameMessage,
  type Participant,
  type LeaderboardEntry as WsLeaderboardEntry,
  type SegmentWinner,
} from '@/hooks/useEventWebSocket'

export function EventParticipantPage() {
  const { eventId, segmentId } = useParams<{ eventId: string; segmentId: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null)
  const [questionText, setQuestionText] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [timeLimit, setTimeLimit] = useState(30)
  const [questionStartedAt, setQuestionStartedAt] = useState<Date | null>(null)

  const [hasAnswered, setHasAnswered] = useState(false)
  const [userAnswer, setUserAnswer] = useState<string | undefined>()
  const [pointsEarned, setPointsEarned] = useState<number | undefined>()

  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<{
    correctAnswer: string
    distribution: AnswerDistribution[]
    segmentLeaderboard: QuizLeaderboardEntry[]
    eventLeaderboard: QuizLeaderboardEntry[]
  } | null>(null)

  const [gameStarted, setGameStarted] = useState(false)

  const [segmentRankings, setSegmentRankings] = useState<LeaderboardEntry[]>([])
  const [eventRankings, setEventRankings] = useState<LeaderboardEntry[]>([])

  const [participants, setParticipants] = useState<Participant[]>([])
  const [joinStatus, setJoinStatus] = useState<'joined' | 'waiting_for_segment' | 'active_in_quiz' | 'segment_complete'>('joined')
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [isPresenterPaused, setIsPresenterPaused] = useState(false)
  const [presenterPausedReason, setPresenterPausedReason] = useState<string | null>(null)
  const [showNameChange, setShowNameChange] = useState(false)
  const [displayName, setDisplayName] = useState<string>(user?.username ?? '')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)

  // Quiz phase state for enhanced message handling
  const [currentPresenterId, setCurrentPresenterId] = useState<string | null>(null)
  const [currentPresenterName, setCurrentPresenterName] = useState<string | null>(null)
  const [_segmentResults, setSegmentResults] = useState<{
    segment_id: string
    segment_title: string
    presenter_name: string
    segment_leaderboard: WsLeaderboardEntry[]
    event_leaderboard: WsLeaderboardEntry[]
    segment_winner?: WsLeaderboardEntry
    event_leader?: WsLeaderboardEntry
  } | null>(null)
  const [_finalResults, setFinalResults] = useState<{
    event_id: string
    final_leaderboard: WsLeaderboardEntry[]
    winner?: WsLeaderboardEntry
    segment_winners: SegmentWinner[]
  } | null>(null)

  useEffect(() => {
    if (!eventId) return
    void loadEventAndLeaderboards()
  }, [eventId, segmentId])

  const loadEventAndLeaderboards = async () => {
    if (!eventId || !segmentId) return
    try {
      setLoading(true)
      const [eventRes, segLb, evtLb] = await Promise.all([
        getEvent(eventId),
        getSegmentLeaderboard(segmentId),
        getMasterLeaderboard(eventId),
      ])
      setEvent(eventRes.data)
      setSegmentRankings(segLb.data)
      setEventRankings(evtLb.data)
    } catch (error) {
      console.error('Failed to load participant view:', error)
      navigate('/events')
    } finally {
      setLoading(false)
    }
  }

  // Track whether we're waiting for a presenter to be selected or to start
  const [pendingPresenterName, setPendingPresenterName] = useState<string | null>(null)
  const [isPendingPresenterSelf, setIsPendingPresenterSelf] = useState(false)
  const [isWaitingForPresenter, setIsWaitingForPresenter] = useState(false)

  const { isConnected, sendMessage, reconnection, pendingPresenter, isPendingPresenter } = useEventWebSocket({
    eventId: eventId ?? '',
    onMessage: (msg: ServerMessage) => {
      if (msg.type === 'connected') {
        setParticipants(msg.participants)
        if (user) {
          const me = msg.participants.find((p) => p.id === user.id)
          if (me?.join_status) {
            setJoinStatus(me.join_status as typeof joinStatus)
          }
          if (me) {
            setDisplayName(me.username)
            setParticipantId(me.id)
          }
        }
      } else if (msg.type === 'participant_joined') {
        setParticipants((prev) => [...prev, { ...msg.user, online: true }])
        if (user && msg.user.id === user.id && msg.user.join_status) {
          setJoinStatus(msg.user.join_status as typeof joinStatus)
        }
      } else if (msg.type === 'participant_left') {
        setParticipants((prev) =>
          prev.map((p) => (p.id === msg.user_id ? { ...p, online: msg.online ?? false } : p))
        )
      } else if (msg.type === 'participant_name_changed') {
        setParticipants((prev) =>
          prev.map((p) => (p.id === msg.user_id ? { ...p, username: msg.new_name } : p))
        )
        // Update local display name if it's the current user
        if (user && msg.user_id === user.id) {
          setDisplayName(msg.new_name)
        }
      } else if (msg.type === 'game_started') {
        setGameStarted(true)
        setShowResults(false)
        setHasAnswered(false)
        setUserAnswer(undefined)
        setPointsEarned(undefined)
        setIsPresenterPaused(false)
        setPresenterPausedReason(null)
      } else if (msg.type === 'question') {
        const isSameQuestion = currentQuestionId === msg.question_id
        const shouldKeepAnswerState = isPresenterPaused && isSameQuestion && hasAnswered

        setCurrentQuestionId(msg.question_id)
        setQuestionText(msg.text)
        setAnswers(msg.answers)
        setTimeLimit(msg.time_limit)
        setQuestionStartedAt(new Date())
        setShowResults(false)

        if (!shouldKeepAnswerState) {
          setHasAnswered(false)
          setUserAnswer(undefined)
          setPointsEarned(undefined)
        }

        setIsPresenterPaused(false)
        setInfoMessage(null)
        if (joinStatus === 'waiting_for_segment') {
          setJoinStatus('active_in_quiz')
        }
      } else if (msg.type === 'reveal') {
        setResults({
          correctAnswer: msg.correct_answer,
          distribution: msg.distribution,
          segmentLeaderboard: msg.segment_leaderboard,
          eventLeaderboard: msg.event_leaderboard,
        })
        setShowResults(true)
      } else if (msg.type === 'scores_update') {
        if (user) {
          const entry = msg.scores.find((s) => s.user_id === user.id)
          if (entry) {
            setPointsEarned(entry.delta)
          }
        }
      } else if (msg.type === 'leaderboard') {
        setSegmentRankings(msg.rankings)
      } else if (msg.type === 'presenter_changed') {
        setCurrentPresenterId(msg.new_presenter_id)
        setCurrentPresenterName(msg.new_presenter_name)
        setIsPresenterPaused(false)

        // If I'm the new presenter, redirect to host view
        if (user && msg.new_presenter_id === user.id) {
          navigate(`/events/${eventId}/host/${msg.segment_id}`)
        }
      } else if (msg.type === 'phase_changed') {
        const paused = msg.phase === 'presenter_paused'
        setIsPresenterPaused(paused)
        if (paused) {
          setQuestionStartedAt(null)
          setInfoMessage('The quiz is paused while the presenter reconnects.')
        } else if (msg.phase === 'showing_question') {
          setInfoMessage(null)
          setPresenterPausedReason(null)
        }
      } else if (msg.type === 'presenter_paused') {
        setIsPresenterPaused(true)
        setQuestionStartedAt(null)
        setPresenterPausedReason(msg.reason ?? null)
        if (msg.reason === 'all_disconnected') {
          setInfoMessage('All participants disconnected. Waiting for someone to rejoin.')
        } else if (msg.reason === 'no_participants') {
          setInfoMessage('No participants are connected. Please wait for participants before resuming.')
        } else {
          setInfoMessage('The presenter disconnected. Waiting for them to reconnect or be reassigned.')
        }
      } else if (msg.type === 'presenter_override_needed') {
        setIsPresenterPaused(true)
        setPresenterPausedReason('presenter_disconnected')
        setInfoMessage('Host is selecting a new presenter. Please wait.')
      } else if (msg.type === 'segment_complete') {
        setSegmentResults({
          segment_id: msg.segment_id,
          segment_title: msg.segment_title,
          presenter_name: msg.presenter_name,
          segment_leaderboard: msg.segment_leaderboard,
          event_leaderboard: msg.event_leaderboard,
          segment_winner: msg.segment_winner,
          event_leader: msg.event_leader,
        })
        setShowResults(false)
        setCurrentQuestionId(null)
        setInfoMessage(null)
        setIsPresenterPaused(false)
        setPresenterPausedReason(null)
      } else if (msg.type === 'event_complete') {
        setFinalResults({
          event_id: msg.event_id,
          final_leaderboard: msg.final_leaderboard,
          winner: msg.winner,
          segment_winners: msg.segment_winners,
        })
        setGameStarted(false)
        setInfoMessage(null)
        setIsPresenterPaused(false)
        setPresenterPausedReason(null)
      } else if (msg.type === 'error') {
        if (msg.message.toLowerCase().includes('next question')) {
          setInfoMessage('You joined mid-question. You can answer starting with the next question.')
          setJoinStatus('waiting_for_segment')
        } else if (msg.message.toLowerCase().includes('paused')) {
          setInfoMessage(msg.message)
          setIsPresenterPaused(true)
        } else if (msg.message.toLowerCase().includes('time expired')) {
          setInfoMessage('Time expired. Your answer was not recorded.')
          setHasAnswered(false)
        }
      } else if (msg.type === 'quiz_generating') {
        setIsGeneratingQuiz(true)
      } else if (msg.type === 'quiz_ready') {
        setIsGeneratingQuiz(false)
      } else if (msg.type === 'presenter_selected') {
        // A presenter has been selected but hasn't started yet
        setPendingPresenterName(msg.presenter_name)
        setIsPendingPresenterSelf(user ? msg.presenter_id === user.id : false)
        setIsWaitingForPresenter(false)
      } else if (msg.type === 'presentation_started') {
        // Presenter has started - clear pending state
        setPendingPresenterName(null)
        setIsPendingPresenterSelf(false)
        setIsWaitingForPresenter(false)
        setCurrentPresenterId(msg.presenter_id)
        setCurrentPresenterName(msg.presenter_name)
        // If current user is the presenter, redirect to host view
        if (user && msg.presenter_id === user.id) {
          navigate(`/events/${eventId}/host/${msg.segment_id}`)
        }
      } else if (msg.type === 'waiting_for_presenter') {
        // No presenter selected yet
        setIsWaitingForPresenter(true)
        setPendingPresenterName(null)
        setIsPendingPresenterSelf(false)
      }
    },
  })

  const handleAnswerSelect = (answer: string, responseTimeMs: number) => {
    if (!currentQuestionId) return
    if (!user || hasAnswered) return
    if (joinStatus === 'waiting_for_segment') {
        return
    }
    if (isPresenterPaused) return

    sendMessage({
      type: 'answer',
      question_id: currentQuestionId,
      selected_answer: answer,
      response_time_ms: responseTimeMs,
    })

    setHasAnswered(true)
    setUserAnswer(answer)
  }

  const handleNameChange = async (newName: string) => {
    if (!eventId || !participantId) {
      throw new Error('Missing event or participant information')
    }
    await updateParticipantDisplayName(eventId, participantId, newName)
    setDisplayName(newName)
  }

  const hasActiveQuestion = !!currentQuestionId && !!questionStartedAt

  const handleStartPresentation = () => {
    const message: GameMessage = { type: 'start_presentation' }
    sendMessage(message)
  }

  const isPresenter = useMemo(() => {
    if (!user || !currentPresenterId) return false
    return user.id === currentPresenterId
  }, [user, currentPresenterId])

  const myRank = useMemo(() => {
    if (!user) return undefined
    const entry = eventRankings.find((r) => r.user_id === user.id)
    return entry?.rank
  }, [eventRankings, user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-gray-400">Joining event...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 flex items-center justify-center">
        <div className="text-red-400">Event not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900">
      {/* Reconnection Status Overlay */}
      <ReconnectionStatus
        isReconnecting={reconnection.isReconnecting}
        attemptCount={reconnection.attemptCount}
        nextAttemptSeconds={reconnection.nextAttemptSeconds}
        hasGivenUp={reconnection.hasGivenUp}
        onManualRetry={() => window.location.reload()}
      />
      
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/events')}
            className="text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {event.title}
            </h1>
            <p className="text-gray-400 text-sm">
              Join code:{' '}
              <span className="font-mono font-semibold text-cyan-400">
                {event.join_code}
              </span>
            </p>
            {currentPresenterName && (
              <div className="text-xs text-cyan-400 mt-1">
                Presenter: {currentPresenterName}
              </div>
            )}
          </div>
          {/* Manage Event button (only shown to host) */}
          {user && event.host_id === user.id && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/events/${eventId}`)}
              className="flex items-center gap-2"
            >
              <Settings size={16} />
              Manage Event
            </Button>
          )}
          <div className="text-right">
            {user && (
              <>
                <div className="text-sm text-gray-500 mb-1">You are</div>
                <div className="flex items-center gap-2 justify-end">
                  <div className="text-white font-semibold">{displayName}</div>
                  <button
                    onClick={() => setShowNameChange(true)}
                    className="text-gray-400 hover:text-cyan-400 transition"
                    title="Change display name"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                {myRank && (
                  <div className="text-xs text-gray-400 mt-1">
                    Current overall rank: #{myRank}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Connection banner */}
        <div className="rounded-lg p-3 text-sm flex items-center justify-between border"
          style={{ borderColor: isConnected ? '#22c55e55' : '#f9731655', background: '#020617' }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-200">
              {isConnected ? 'Connected to live game' : 'Reconnecting...'}
            </span>
            {currentPresenterName && (
              <div className="text-xs text-cyan-400 ml-2">
                Presenter: {currentPresenterName}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Players connected: {participants.length}
          </div>
        </div>

        {isPresenterPaused && (
          <div className="bg-amber-900/40 border border-amber-500/40 rounded-lg p-3 text-sm text-amber-100">
            The quiz is paused while the presenter reconnects or the host selects a replacement. You can keep this page open—questions will resume automatically.
          </div>
        )}

        {/* Segment Complete View */}
        {_segmentResults && !_finalResults && (
          <SegmentCompleteView
            segmentTitle={_segmentResults.segment_title}
            segmentLeaderboard={_segmentResults.segment_leaderboard}
            eventLeaderboard={_segmentResults.event_leaderboard}
            segmentWinner={_segmentResults.segment_winner}
            isPresenter={false}
          />
        )}

        {/* Event Complete View */}
        {_finalResults && (
          <EventCompleteView
            finalLeaderboard={_finalResults.final_leaderboard}
            winner={_finalResults.winner}
            segmentWinners={_finalResults.segment_winners}
          />
        )}

        {/* Presenter Indicator */}
        {isPresenter && !_segmentResults && !_finalResults && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
            <span className="text-cyan-400">You are the presenter! </span>
            {segmentId && (
              <Button onClick={() => navigate(`/events/${eventId}/host/${segmentId}`)}>
                Go to Presenter View
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr] gap-6 items-start">
          {/* Left: waiting room / question / results */}
          <div className="space-y-4">
            {!gameStarted && !hasActiveQuestion && (
              <div className="space-y-3">
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                  {/* Show different states based on presenter selection */}
                  {isPendingPresenterSelf || isPendingPresenter ? (
                    // Current user is the selected presenter - show start button
                    <>
                      <h2 className="text-lg font-semibold text-cyan-400 mb-1">
                        You&apos;ve been selected as presenter
                      </h2>
                      <p className="text-sm text-gray-400 mb-4">
                        When you&apos;re ready, click the button below to start your presentation segment.
                        Recording will begin automatically.
                      </p>
                      <Button onClick={handleStartPresentation} className="w-full">
                        Start Presentation
                      </Button>
                    </>
                  ) : pendingPresenterName || pendingPresenter ? (
                    // Another user is the selected presenter - waiting for them to start
                    <>
                      <h2 className="text-lg font-semibold text-white mb-1">
                        Waiting for presenter to start
                      </h2>
                      <p className="text-sm text-gray-400">
                        <span className="text-cyan-400 font-medium">
                          {pendingPresenterName || pendingPresenter?.name}
                        </span>{' '}
                        has been selected as the presenter. Waiting for them to begin their presentation.
                      </p>
                    </>
                  ) : isWaitingForPresenter ? (
                    // No presenter selected yet
                    <>
                      <h2 className="text-lg font-semibold text-white mb-1">
                        Waiting for host to select a presenter
                      </h2>
                      <p className="text-sm text-gray-400">
                        The host will select a presenter to begin the next segment.
                        In the meantime, tap or press space to flap your bird in the lobby.
                      </p>
                    </>
                  ) : (
                    // Default state - waiting for quiz to start
                    <>
                      <h2 className="text-lg font-semibold text-white mb-1">
                        Waiting for host to start the quiz
                      </h2>
                      <p className="text-sm text-gray-400">
                        In the meantime, tap or press space to flap your bird in the lobby –
                        all players&apos; birds are visible here.
                      </p>
                    </>
                  )}
                </div>
                <FlappyGame participants={participants} currentUserId={user?.id} />
              </div>
            )}

            {hasActiveQuestion && (
              <div className="space-y-4">
                {infoMessage && (
                  <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-3 text-amber-100 text-sm">
                    {infoMessage}
                  </div>
                )}
                <QuestionDisplay
                  questionId={currentQuestionId!}
                  text={questionText}
                  timeLimit={timeLimit}
                  onTimeUp={() => setHasAnswered(true)}
                />
                <AnswerSelection
                  answers={answers}
                  onSelect={handleAnswerSelect}
                  timeLimit={timeLimit}
                  questionStartedAt={questionStartedAt ?? new Date()}
                  disabled={hasAnswered || joinStatus === 'waiting_for_segment' || isPresenterPaused}
                />
                {hasAnswered && !showResults && (
                  <p className="text-sm text-gray-400">
                    Answer submitted. Waiting for others to finish...
                  </p>
                )}
              </div>
            )}

            {showResults && results && (
              <QuizResults
                correctAnswer={results.correctAnswer}
                distribution={results.distribution}
                userAnswer={userAnswer}
                pointsEarned={pointsEarned}
                segmentLeaderboard={results.segmentLeaderboard}
                eventLeaderboard={results.eventLeaderboard}
              />
            )}

            {!hasActiveQuestion && gameStarted && !showResults && (
              <div className="bg-dark-900 rounded-lg p-6 border border-dark-700 text-center">
                <p className="text-gray-300">Waiting for the next question...</p>
              </div>
            )}
          </div>

          {/* Right: leaderboards */}
          <div className="space-y-4">
            <SegmentLeaderboard rankings={segmentRankings} />
            <MasterLeaderboard rankings={eventRankings} />
            <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
              <h3 className="text-sm font-semibold text-white mb-2">Need to leave?</h3>
              <p className="text-xs text-gray-400 mb-3">
                You can safely close this tab and rejoin later using the same join code.
              </p>
              <Button variant="secondary" onClick={() => navigate('/events')}>
                Back to Events
              </Button>
            </div>
          </div>
        </div>

        {/* Change Display Name Modal */}
        {showNameChange && (
          <ChangeDisplayName
            currentName={displayName}
            onNameChange={handleNameChange}
            onClose={() => setShowNameChange(false)}
          />
        )}

        {/* Flappy Bird during quiz generation */}
        {isGeneratingQuiz && (
          <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center">
            <FlappyBird />
          </div>
        )}
      </div>
    </div>
  )
}


