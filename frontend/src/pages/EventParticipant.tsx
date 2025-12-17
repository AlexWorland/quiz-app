import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { QuestionDisplay } from '@/components/quiz/QuestionDisplay'
import { AnswerSelection } from '@/components/quiz/AnswerSelection'
import { QuizResults, type AnswerDistribution, type LeaderboardEntry as QuizLeaderboardEntry } from '@/components/quiz/QuizResults'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import { FlappyGame } from '@/components/flappy/FlappyGame'
import { Button } from '@/components/common/Button'

import {
  getEvent,
  getSegmentLeaderboard,
  getMasterLeaderboard,
  type Event,
  type LeaderboardEntry,
} from '@/api/endpoints'
import {
  useEventWebSocket,
  type ServerMessage,
  type Participant,
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
        setGameStarted(true)
        setShowResults(false)
        setHasAnswered(false)
        setUserAnswer(undefined)
        setPointsEarned(undefined)
      } else if (msg.type === 'question') {
        setCurrentQuestionId(msg.question_id)
        setQuestionText(msg.text)
        setAnswers(msg.answers)
        setTimeLimit(msg.time_limit)
        setQuestionStartedAt(new Date())
        setShowResults(false)
        setHasAnswered(false)
        setUserAnswer(undefined)
        setPointsEarned(undefined)
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
      }
    },
  })

  const handleAnswerSelect = (answer: string, responseTimeMs: number) => {
    if (!currentQuestionId) return
    if (!user || hasAnswered) return

    sendMessage({
      type: 'answer',
      question_id: currentQuestionId,
      selected_answer: answer,
      response_time_ms: responseTimeMs,
    })

    setHasAnswered(true)
    setUserAnswer(answer)
  }

  const hasActiveQuestion = !!currentQuestionId && !!questionStartedAt

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
          </div>
          <div className="text-right">
            {user && (
              <>
                <div className="text-sm text-gray-500 mb-1">You are</div>
                <div className="text-white font-semibold">{user.username}</div>
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
          </div>
          <div className="text-xs text-gray-400">
            Players connected: {participants.length}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr] gap-6 items-start">
          {/* Left: waiting room / question / results */}
          <div className="space-y-4">
            {!gameStarted && !hasActiveQuestion && (
              <div className="space-y-3">
                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                  <h2 className="text-lg font-semibold text-white mb-1">
                    Waiting for host to start the quiz
                  </h2>
                  <p className="text-sm text-gray-400">
                    In the meantime, tap or press space to flap your bird in the lobby –
                    all players&apos; birds are visible here.
                  </p>
                </div>
                <FlappyGame participants={participants} currentUserId={user?.id} />
              </div>
            )}

            {hasActiveQuestion && (
              <div className="space-y-4">
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
                  disabled={hasAnswered}
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
      </div>
    </div>
  )
}


