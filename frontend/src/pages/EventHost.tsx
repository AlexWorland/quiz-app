import { useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Play, Download, ChevronDown } from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/common/Button'
import { ExportErrorNotice } from '@/components/export/ExportErrorNotice'
import { PassPresenterButton } from '@/components/quiz/PassPresenterButton'
import { AdminPresenterSelect } from '@/components/quiz/AdminPresenterSelect'
import { JoinLockReminder } from '@/components/event/JoinLockReminder'
import { EventSettings } from '@/components/event/EventSettings'
import { AnswerProgress } from '@/components/quiz/AnswerProgress'
import { PresenterControls } from '@/components/quiz/PresenterControls'
import { SegmentCompleteView } from '@/components/quiz/SegmentCompleteView'
import { ResumeControls } from '@/components/quiz/ResumeControls'
import { RecordingControls } from '@/components/recording/RecordingControls'
import { RecordingStatus } from '@/components/recording/RecordingStatus'
import { ChunkUploadStatus } from '@/components/recording/ChunkUploadStatus'
import { ProcessingLogs } from '@/components/recording/ProcessingLogs'
import { TranscriptView } from '@/components/recording/TranscriptView'
import { GeneratedQuestionList } from '@/components/questions/GeneratedQuestionList'
import { QuizReadyIndicator } from '@/components/questions/QuizReadyIndicator'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import { QuestionCreator } from '@/components/questions/QuestionCreator'
import { QRCodeDisplay } from '@/components/event/QRCodeDisplay'
import { BulkQuestionImport } from '@/components/questions/BulkQuestionImport'
import { NoQuestionsNotice } from '@/components/questions/NoQuestionsNotice'
import { AIServiceErrorNotice } from '@/components/questions/AIServiceErrorNotice'
import { MasterLeaderboard } from '@/components/leaderboard/MasterLeaderboard'
import { SegmentLeaderboard } from '@/components/leaderboard/SegmentLeaderboard'
import { FlappyBird } from '@/components/games/FlappyBird'

import {
  eventAPI,
  type Event,
  type Segment,
  type Question,
  type LeaderboardEntry,
  type ExportFormat,
  getSegmentQuestions,
  getSegmentLeaderboard,
  getMasterLeaderboard,
  getSegment,
  exportEventResults,
  downloadExport,
  resumeSegment,
  clearSegmentResumeState,
  resumeEvent,
  clearEventResumeState,
  unlockEventJoin,
  transcribeSegmentAudio,
  startRecording as startRecordingApi,
  stopRecording as stopRecordingApi,
} from '@/api/endpoints'
import { useChunkedAudioRecording } from '@/hooks/useChunkedAudioRecording'
import { useEventWebSocket, type ServerMessage, type Participant, type QuizPhase, type LeaderboardEntry as WsLeaderboardEntry, type SegmentWinner } from '@/hooks/useEventWebSocket'
import { DisplayModeContainer } from '@/components/display/DisplayModeContainer'
import { WaitingForParticipants } from '@/components/quiz/WaitingForParticipants'
import { calculateBackoffDelay, sleep, getExportFileName } from '@/utils/retryExport'
import { EmergencyPresenterSelect } from '@/components/quiz/EmergencyPresenterSelect'
import { SingleSegmentReview } from '@/components/quiz/SingleSegmentReview'

const MAX_EXPORT_RETRIES = 3
const BASE_DELAY_MS = 1000

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
  const [presenterPausedReason, setPresenterPausedReason] = useState<string | null>(null)

  // Tab state for manual question management (legacy mode)
  const [activeTab, setActiveTab] = useState<'add' | 'import' | 'list'>('add')
  const [showManualQuestionForm, setShowManualQuestionForm] = useState(false)

  // Export state
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportRetryCount, setExportRetryCount] = useState(0)
  const [pendingExportFormat, setPendingExportFormat] = useState<ExportFormat | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Resume warning state
  const [resumeWarning, setResumeWarning] = useState<string | null>(null)

  // Display mode state
  const [processingStatus, setProcessingStatus] = useState<{
    step: 'transcribing' | 'generating' | 'ready'
    progress?: number
    message: string
  } | null>(null)
  const [previousRankings, setPreviousRankings] = useState<LeaderboardEntry[]>([])

  // AI error state
  const [aiError, setAiError] = useState<{
    type: 'service_unavailable' | 'rate_limit' | 'connection_error' | 'unknown' | 'microphone_error' | 'generation_error'
    message: string
  } | null>(null)
  const [isRetryingAiGeneration, setIsRetryingAiGeneration] = useState(false)

  // Join lock reminder state
  const [joinLockTimestamp, setJoinLockTimestamp] = useState<number | null>(null)
  const [joinLockDuration, setJoinLockDuration] = useState(0)
  const [showJoinLockReminder, setShowJoinLockReminder] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const joinLockIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Quiz phase state for enhanced message handling
  const [quizPhase, setQuizPhase] = useState<QuizPhase>('not_started')
  const [allAnswered, setAllAnswered] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [currentPresenterName, setCurrentPresenterName] = useState<string | null>(null)
  const [presenterDisconnectWarning, setPresenterDisconnectWarning] = useState<{ name: string; segmentId: string } | null>(null)
  const [presenterPaused, setPresenterPaused] = useState(false)
  const [presenterOverrideNeeded, setPresenterOverrideNeeded] = useState<{ name: string; segmentId: string } | null>(null)
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

  // Mega quiz state
  const [megaQuizReady, setMegaQuizReady] = useState<{
    event_id: string
    available_questions: number
    current_leaderboard: WsLeaderboardEntry[]
    is_single_segment?: boolean
    single_segment_mode?: 'remix' | 'skip' | null
  } | null>(null)
  const [megaQuizStarted, setMegaQuizStarted] = useState(false)
  const [megaQuizQuestionCount, setMegaQuizQuestionCount] = useState(10)
  const [megaQuizModeChoice, setMegaQuizModeChoice] = useState<'remix' | 'skip'>('remix')

  const qualityThreshold = 0.7

  const goodQuestionCount = useMemo(
    () =>
      questions.filter((q) => (q.quality_score ?? 0) > qualityThreshold).length,
    [questions]
  )

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (joinLockIntervalRef.current) {
        clearInterval(joinLockIntervalRef.current)
      }
    }
  }, [])

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

  // Monitor join lock status and track duration
  useEffect(() => {
    if (!event) return

    if (event.join_locked && !joinLockTimestamp) {
      // Lock just turned on, record timestamp
      const lockedAt = event.join_locked_at ? new Date(event.join_locked_at).getTime() : Date.now()
      setJoinLockTimestamp(lockedAt)
    } else if (!event.join_locked && joinLockTimestamp) {
      // Lock just turned off, reset tracking
      setJoinLockTimestamp(null)
      setJoinLockDuration(0)
      setShowJoinLockReminder(false)
      if (joinLockIntervalRef.current) {
        clearInterval(joinLockIntervalRef.current)
        joinLockIntervalRef.current = null
      }
    }
  }, [event?.join_locked, joinLockTimestamp])

  // Update lock duration every 30 seconds and show reminder after 5 minutes
  useEffect(() => {
    if (!joinLockTimestamp || !event?.join_locked) {
      return
    }

    const updateDuration = () => {
      const now = Date.now()
      const duration = Math.floor((now - joinLockTimestamp) / 1000)
      setJoinLockDuration(duration)

      // Show reminder if locked for more than 5 minutes (300 seconds)
      if (duration > 300) {
        setShowJoinLockReminder(true)
      }
    }

    updateDuration()
    joinLockIntervalRef.current = setInterval(updateDuration, 30000) // Update every 30 seconds

    return () => {
      if (joinLockIntervalRef.current) {
        clearInterval(joinLockIntervalRef.current)
        joinLockIntervalRef.current = null
      }
    }
  }, [joinLockTimestamp, event?.join_locked])

  // Chunked audio recording for transcription
  const { 
    isRecording: isAudioRecording,
    chunksUploaded, 
    uploadingChunk,
    startRecording, 
    stopRecording 
  } = useChunkedAudioRecording({
    segmentId: segmentId ?? '',
    onChunkUploaded: (result) => {
      if (result.success) {
        console.log(`Chunk ${result.chunkIndex} uploaded successfully`)
      } else {
        console.error(`Chunk ${result.chunkIndex} failed:`, result.error)
      }
    },
    onError: (error) => {
      setAiError({
        type: 'microphone_error',
        message: error
      })
    }
  })
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [showProcessingLogs, setShowProcessingLogs] = useState(false)

  // Event WebSocket for quiz flow and participant tracking
  const { isConnected, sendMessage, currentPresenter, presenterPaused: wsPresenterPaused, isPresenter: isCurrentPresenter } = useEventWebSocket({
    eventId: eventId ?? '',
    onMessage: (msg: ServerMessage) => {
      if (msg.type === 'error') {
        // Display error messages to user
        alert(msg.message)
      } else if (msg.type === 'connected') {
        setParticipants(msg.participants)
      } else if (msg.type === 'participant_joined') {
        setParticipants((prev) => [...prev, { ...msg.user, online: true }])
      } else if (msg.type === 'participant_left') {
        setParticipants((prev) =>
          prev.map((p) => (p.id === msg.user_id ? { ...p, online: msg.online ?? false } : p))
        )
      } else if (msg.type === 'game_started') {
        setIsQuizActive(true)
        setCurrentQuestionIndex(0)
        setPresenterPaused(false)
        setPresenterPausedReason(null)
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
        setPresenterPaused(msg.phase === 'presenter_paused')
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
        setPresenterPaused(false)
        setPresenterPausedReason(null)
      } else if (msg.type === 'event_complete') {
        setEventComplete({
          event_id: msg.event_id,
          final_leaderboard: msg.final_leaderboard,
          winner: msg.winner,
          segment_winners: msg.segment_winners,
        })
        setIsQuizActive(false)
        setPresenterPaused(false)
        setPresenterPausedReason(null)
        setMegaQuizReady(null) // Clear mega quiz ready when event completes
      } else if (msg.type === 'mega_quiz_ready') {
        const defaultMode = (msg.single_segment_mode as 'remix' | 'skip' | undefined) ?? 'remix'
        setMegaQuizReady({
          event_id: msg.event_id,
          available_questions: msg.available_questions,
          current_leaderboard: msg.current_leaderboard,
          is_single_segment: msg.is_single_segment ?? false,
          single_segment_mode: msg.single_segment_mode ?? null,
        })
        setMegaQuizModeChoice(defaultMode)
        setSegmentComplete(null) // Clear segment complete when moving to mega quiz ready
      } else if (msg.type === 'presenter_paused') {
        setPresenterPaused(true)
        setPresenterPausedReason(msg.reason ?? null)
        setPresenterDisconnectWarning({
          name: msg.presenter_name,
          segmentId: msg.segment_id
        })
      } else if (msg.type === 'presenter_override_needed') {
        setPresenterPaused(true)
        setPresenterPausedReason('presenter_disconnected')
        setPresenterOverrideNeeded({
          name: msg.presenter_name,
          segmentId: msg.segment_id
        })
      } else if (msg.type === 'presenter_disconnected') {
        // Show warning banner to host
        setPresenterDisconnectWarning({
          name: msg.presenter_name,
          segmentId: msg.segment_id
        })
      } else if (msg.type === 'mega_quiz_started') {
        setMegaQuizStarted(true)
        setMegaQuizReady(null)
        setIsQuizActive(true)
      } else if (msg.type === 'quiz_generating') {
        setIsGeneratingQuiz(true)
      } else if (msg.type === 'quiz_ready') {
        setIsGeneratingQuiz(false)
        // Refresh questions
        if (segmentId) {
          void getSegmentQuestions(segmentId).then((res) => setQuestions(res.data))
        }
      }
    },
  })

  useEffect(() => {
    setPresenterPaused(wsPresenterPaused)
    if (!wsPresenterPaused) {
      setPresenterDisconnectWarning(null)
      setPresenterOverrideNeeded(null)
      setPresenterPausedReason(null)
    }
  }, [wsPresenterPaused])

  // Determine if user can control presenter functions (host or current presenter)
  const isHost = event && user && event.host_id === user.id
  const canControlPresenter = isHost || isCurrentPresenter
  const onlineParticipantCount = participants.filter((p) => p.online !== false).length

  // Host control handlers
  const handleStartQuiz = () => {
    if (presenterPaused) return
    sendMessage({ type: 'start_game' })
  }

  const handleNextQuestion = () => {
    if (presenterPaused) return
    setCurrentQuestionIndex((prev) => prev + 1)
    sendMessage({ type: 'next_question' })
  }

  const handleRevealAnswer = () => {
    if (presenterPaused) return
    sendMessage({ type: 'reveal_answer' })
  }

  const handleShowLeaderboard = () => {
    if (presenterPaused) return
    sendMessage({ type: 'show_leaderboard' })
  }

  const handleEndQuiz = () => {
    if (presenterPaused) return
    sendMessage({ type: 'end_game' })
  }

  const handleStartMegaQuiz = () => {
    if (presenterPaused) return
    sendMessage({ type: 'start_mega_quiz', question_count: megaQuizQuestionCount })
  }

  const handleMegaQuizPrimary = () => {
    if (megaQuizModeChoice === 'skip') {
      handleSkipMegaQuiz()
      return
    }
    handleStartMegaQuiz()
  }

  const handleSkipMegaQuiz = () => {
    if (presenterPaused) return
    sendMessage({ type: 'skip_mega_quiz' })
  }

  const handleStartRecording = async () => {
    if (!segmentId) return
    try {
      await startRecording()
      const res = await startRecordingApi(segmentId)
      setSegment(res.data)
    } catch (error) {
      console.error('Failed to start recording:', error)
      setAiError({ 
        type: 'microphone_error', 
        message: 'Could not access microphone' 
      })
    }
  }

  // Auto-start recording when arriving at a segment with status='recording'
  // This happens when presenter clicks "Start Presentation" and is navigated here
  const hasAutoStartedRecording = useRef(false)
  useEffect(() => {
    if (segment?.status === 'recording' && !isAudioRecording && !hasAutoStartedRecording.current) {
      hasAutoStartedRecording.current = true
      void handleStartRecording()
    }
  }, [segment?.status, isAudioRecording])

  // Reset auto-start flag when segment changes
  useEffect(() => {
    hasAutoStartedRecording.current = false
  }, [segmentId])

  const handleGenerateQuiz = async () => {
    if (!segmentId) return
    
    // Check if any chunks were uploaded
    if (chunksUploaded === 0) {
      setAiError({
        type: 'generation_error',
        message: 'No audio chunks recorded. Please record for at least 1 minute.'
      })
      return
    }
    
    setIsGeneratingQuiz(true)
    setAiError(null)
    
    try {
      stopRecording()
      const res = await stopRecordingApi(segmentId)
      setSegment(res.data)
      
      // Call finalize endpoint (chunks already uploaded)
      const { finalizeRecordingAndGenerate } = await import('@/api/endpoints')
      await finalizeRecordingAndGenerate(segmentId)
      
      // Navigation and question refresh handled by quiz_ready WebSocket message
    } catch (error) {
      console.error('Failed to generate quiz:', error)
      setAiError({
        type: 'generation_error',
        message: error instanceof Error ? error.message : 'Failed to generate quiz'
      })
      setIsGeneratingQuiz(false)
    }
  }

  const handlePauseRecording = async () => {
    // Not needed for new flow
  }

  const handleResumeRecording = async () => {
    // Not needed for new flow
  }

  const handleStopRecording = handleGenerateQuiz

  const handleRestartRecording = async () => {
    if (!segmentId) return
    try {
      // Not implemented in new flow - would need to restart recording
      // For now, just clear local state
      stopRecording()
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
    if (event?.mode === 'listen_only') {
      setShowManualQuestionForm(false)
    }
  }

  const performExport = async (format: ExportFormat, attempt: number = 1): Promise<void> => {
    if (!eventId || !event) return

    try {
      setIsExporting(true)
      const response = await exportEventResults(eventId, format)
      const filename = getExportFileName(format, event.title)
      downloadExport(response.data, filename)
      setExportError(null)
      setExportRetryCount(0)
      setPendingExportFormat(null)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred during export'

      if (attempt < MAX_EXPORT_RETRIES) {
        setExportError(
          `Export failed: ${errorMessage}. Retrying... (Attempt ${attempt} of ${MAX_EXPORT_RETRIES})`
        )
        setExportRetryCount(attempt)
        setPendingExportFormat(format)

        const delay = calculateBackoffDelay(attempt, BASE_DELAY_MS)
        retryTimeoutRef.current = setTimeout(() => {
          void performExport(format, attempt + 1)
        }, delay)
      } else {
        setExportError(
          `Export failed after ${MAX_EXPORT_RETRIES} attempts: ${errorMessage}. Please try again later.`
        )
        setExportRetryCount(attempt)
        setPendingExportFormat(format)
      }
    } finally {
      setIsExporting(false)
    }
  }

  const handleExport = async (format: ExportFormat) => {
    if (!eventId || !event) return
    setShowExportMenu(false)
    setExportError(null)
    setExportRetryCount(0)

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    await performExport(format)
  }

  const handleRetryExport = async () => {
    if (!pendingExportFormat) return

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }

    await performExport(pendingExportFormat)
  }

  const handleResumeSegment = async () => {
    if (!segmentId) return
    try {
      const res = await resumeSegment(segmentId)
      setSegment(res.data)

      // Check for warning header about no participants
      const warning = res.headers?.['x-warning']
      if (warning) {
        setResumeWarning(warning)
        // Clear warning after 10 seconds
        setTimeout(() => setResumeWarning(null), 10000)
      } else {
        setResumeWarning(null)
      }
    } catch (error) {
      console.error('Failed to resume segment:', error)
      throw error
    }
  }

  const handleClearSegmentResume = async () => {
    if (!segmentId) return
    try {
      const res = await clearSegmentResumeState(segmentId)
      setSegment(res.data)
    } catch (error) {
      console.error('Failed to clear segment resume state:', error)
      throw error
    }
  }

  const handleResumeEvent = async () => {
    if (!eventId) return
    try {
      const res = await resumeEvent(eventId)
      setEvent(res.data)

      // Check for warning header about no participants
      const warning = res.headers?.['x-warning']
      if (warning) {
        setResumeWarning(warning)
        // Clear warning after 10 seconds
        setTimeout(() => setResumeWarning(null), 10000)
      } else {
        setResumeWarning(null)
      }
    } catch (error) {
      console.error('Failed to resume event:', error)
      throw error
    }
  }

  const handleClearEventResume = async () => {
    if (!eventId) return
    try {
      const res = await clearEventResumeState(eventId)
      setEvent(res.data)
    } catch (error) {
      console.error('Failed to clear event resume state:', error)
      throw error
    }
  }

  const handleSkipSegment = async () => {
    if (!segmentId) return
    try {
      // Complete the segment without running quiz
      await eventAPI.updateSegment(eventId!, segmentId, { status: 'completed' })
      // Reload to refresh state
      await loadEventAndSegment()
    } catch (error) {
      console.error('Failed to skip segment:', error)
    }
  }

  const handleUnlockJoin = async () => {
    if (!eventId) return
    try {
      setIsUnlocking(true)
      await unlockEventJoin(eventId)
      setEvent(prev => prev ? { ...prev, join_locked: false, join_locked_at: undefined } : prev)
      setShowJoinLockReminder(false)
    } catch (error) {
      console.error('Failed to unlock join:', error)
    } finally {
      setIsUnlocking(false)
    }
  }

  const handleDismissJoinLockReminder = () => {
    setShowJoinLockReminder(false)
  }

  const handleAddQuestionsManually = () => {
    setActiveTab('add')
    setShowManualQuestionForm(true)
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
            {currentPresenter && (
              <div className="flex items-center gap-2 text-sm text-cyan-400 mt-1">
                <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                Current Presenter: {currentPresenter.name}
                {isCurrentPresenter && <span className="text-xs text-white/60">(You)</span>}
              </div>
            )}
          </div>
          <div className="flex items-start gap-4">
            <AdminPresenterSelect
              participants={participants.map(p => ({ id: p.id, username: p.username, avatar_url: p.avatar_url }))}
              segmentId={segmentId ?? ''}
              onSelect={(presenterId, segId) => {
                sendMessage({ type: 'admin_select_presenter', presenter_user_id: presenterId, segment_id: segId })
              }}
            />
            {/* Event Settings Button */}
            <EventSettings
              event={event}
              onUpdate={(updatedEvent) => {
                // Optionally refresh event data after update
                console.log('Event updated:', updatedEvent)
              }}
            />
            {/* Join as Participant Button - Navigate in-app */}
            <Button
              variant="secondary"
              onClick={() => {
                // Navigate to event detail where they can join
                navigate(`/events/${eventId}`)
              }}
              className="text-sm"
            >
              Join as Participant
            </Button>
            {/* Processing Logs Button */}
            <Button
              variant="secondary"
              onClick={() => setShowProcessingLogs(true)}
              className="text-sm"
            >
              View Logs
            </Button>
            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-sm text-gray-300 hover:text-white transition disabled:opacity-50"
                title="Export event results"
              >
                <Download className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
                {isExporting ? 'Exporting...' : 'Export'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 bg-dark-900 border border-dark-700 shadow-xl rounded-lg p-2 z-20 min-w-[140px]">
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-800 hover:text-white rounded transition"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-dark-800 hover:text-white rounded transition"
                  >
                    Export as CSV
                  </button>
                </div>
              )}
            </div>
            <div className="text-right">
              <QRCodeDisplay
                joinCode={event.join_code}
                isLocked={event.join_locked}
                size={200}
              />
            </div>
          </div>
        </div>

        {exportError && (
          <ExportErrorNotice
            error={exportError}
            retryCount={exportRetryCount}
            maxRetries={MAX_EXPORT_RETRIES}
            onRetry={handleRetryExport}
            onDismiss={() => {
              setExportError(null)
              setExportRetryCount(0)
              setPendingExportFormat(null)
            }}
          />
        )}

        {showJoinLockReminder && (
          <JoinLockReminder
            lockDuration={joinLockDuration}
            onUnlock={handleUnlockJoin}
            onDismiss={handleDismissJoinLockReminder}
            isLoading={isUnlocking}
          />
        )}

        {/* Special UI for all participants disconnected */}
        {presenterPaused && presenterPausedReason === 'all_disconnected' && (
          <div className="mb-4">
            <WaitingForParticipants
              eventTitle={event.title}
              eventCode={event.join_code}
              segmentTitle={segment.title || undefined}
              presenterName={segment.presenter_name}
              participantCount={participants.filter(p => p.online).length}
              onRefresh={() => {
                // Refresh participant list by reloading event data
                loadEventAndSegment()
              }}
              onResume={canControlPresenter ? async () => {
                try {
                  await handleResumeSegment()
                  setPresenterPaused(false)
                  setPresenterPausedReason(null)
                } catch (error) {
                  console.error('Failed to resume from pause:', error)
                }
              } : undefined}
              isHost={canControlPresenter}
            />
          </div>
        )}

        {((presenterPaused && presenterPausedReason !== 'all_disconnected') || presenterDisconnectWarning) && (
          <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-300 mb-1">
                  {presenterPausedReason === 'all_disconnected'
                    ? 'All participants disconnected — paused'
                    : presenterPausedReason === 'no_participants'
                      ? 'No participants connected'
                      : 'Quiz paused — presenter disconnected'}
                </h3>
                <p className="text-sm text-amber-100/90 mb-3">
                  {presenterPausedReason === 'all_disconnected'
                    ? 'All participants left the event. Waiting for someone to rejoin before resuming.'
                    : presenterPausedReason === 'no_participants'
                      ? 'No participants are connected. Resume will continue once someone joins.'
                      : (
                        <>
                          <span className="font-medium">{presenterOverrideNeeded?.name ?? presenterDisconnectWarning?.name ?? 'Current presenter'}</span> is offline. The quiz is paused until they return or you assign a new presenter.
                        </>
                      )}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <PassPresenterButton
                    participants={participants.map(p => ({ id: p.id, username: p.username, avatar_url: p.avatar_url, online: p.online }))}
                    currentUserId={user?.id || ''}
                    onPass={(nextPresenterId) => {
                      sendMessage({ type: 'pass_presenter', next_presenter_user_id: nextPresenterId })
                    }}
                  />
                  <button
                    onClick={() => {
                      setPresenterDisconnectWarning(null)
                      setPresenterOverrideNeeded(null)
                    }}
                    className="text-xs text-amber-200 hover:text-white transition underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Event Resume Controls */}
        {event.previous_status && (
          <ResumeControls
            type="event"
            previousStatus={event.previous_status}
            onResume={handleResumeEvent}
            onClearResume={handleClearEventResume}
            warningMessage={resumeWarning}
          />
        )}

        {/* Listen-Only Mode: Recording status + controls */}
        {event.mode === 'listen_only' && (
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_2fr] gap-6">
            <div className="bg-dark-900 rounded-lg p-6 border border-dark-700 space-y-4">
              <h2 className="text-lg font-semibold text-white mb-2">Recording Status</h2>
              {/* Audio format notice removed - using standard WebM */}
              <RecordingStatus status={segment.status} startedAt={segment.recording_started_at} />
              {isAudioRecording && (
                <ChunkUploadStatus chunksUploaded={chunksUploaded} isUploading={uploadingChunk} />
              )}
              <div className="text-sm text-gray-400 mb-2">
                When finished presenting, press "Generate Quiz"
              </div>
              <RecordingControls
                status={segment.status}
                onStart={handleStartRecording}
                onPause={handlePauseRecording}
                onResume={handleResumeRecording}
                onStop={handleStopRecording}
                onRestart={handleRestartRecording}
              />

              {/* Segment Resume Controls for Listen-Only Mode */}
              {segment.previous_status && (
                <div className="mt-4">
                  <ResumeControls
                    type="segment"
                    previousStatus={segment.previous_status}
                    onResume={handleResumeSegment}
                    onClearResume={handleClearSegmentResume}
                    warningMessage={resumeWarning}
                  />
                </div>
              )}
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
          {/* Segment Resume Controls (visible in all modes) */}
          {segment.previous_status && event.mode !== 'listen_only' && (
            <div className="mb-4">
              <ResumeControls
                type="segment"
                previousStatus={segment.previous_status}
                onResume={handleResumeSegment}
                onClearResume={handleClearSegmentResume}
                warningMessage={resumeWarning}
              />
            </div>
          )}

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
                {onlineParticipantCount} participant{onlineParticipantCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Single Segment Review UI */}
          {megaQuizReady && !isQuizActive && megaQuizReady.is_single_segment && (
            <div className="mb-4">
              <SingleSegmentReview
                eventId={eventId!}
                eventTitle={event.title}
                segmentTitle={segment.title || undefined}
                availableQuestions={megaQuizReady.available_questions}
                currentLeaderboard={megaQuizReady.current_leaderboard}
                onStartReview={(questionCount) => {
                  sendMessage({ type: 'start_mega_quiz', question_count: questionCount })
                }}
                onSkipToResults={() => {
                  sendMessage({ type: 'skip_mega_quiz' })
                }}
                isHost={canControlPresenter}
              />
            </div>
          )}

          {/* Regular Mega Quiz Ready UI (multi-segment events) */}
          {megaQuizReady && !isQuizActive && !megaQuizReady.is_single_segment && (
            <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-lg p-4 border border-purple-700/50 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-bold text-purple-300">🏆 Mega Quiz Available!</h3>
                  <p className="text-sm text-gray-400">
                    All segments complete. Run a final quiz with questions from all segments?
                  </p>
                </div>
                <div className="text-right text-sm text-gray-400">
                  {megaQuizReady.available_questions} questions available
                </div>
              </div>
              {megaQuizReady.is_single_segment && (
                <div className="flex flex-col gap-3 mb-3 text-sm text-gray-200">
                  <div>Single-segment event: choose how to finish.</div>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mega-mode"
                        value="remix"
                        checked={megaQuizModeChoice === 'remix'}
                        onChange={() => setMegaQuizModeChoice('remix')}
                      />
                      <span>Remix with current questions</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="mega-mode"
                        value="skip"
                        checked={megaQuizModeChoice === 'skip'}
                        onChange={() => setMegaQuizModeChoice('skip')}
                      />
                      <span>Skip mega quiz and show results</span>
                    </label>
                  </div>
                  {megaQuizModeChoice === 'skip' && (
                    <p className="text-amber-300 text-xs">
                      Skipping will finalize results without an extra round. This cannot be undone.
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label htmlFor="megaQuizCount" className="text-sm text-gray-300">
                    Questions:
                  </label>
                  <input
                    id="megaQuizCount"
                    type="number"
                    min={1}
                    max={megaQuizReady.available_questions}
                    value={megaQuizQuestionCount}
                    onChange={(e) => setMegaQuizQuestionCount(Math.min(Math.max(1, parseInt(e.target.value) || 1), megaQuizReady.available_questions))}
                    className="w-16 px-2 py-1 bg-dark-800 border border-dark-600 rounded text-white text-sm"
                    disabled={presenterPaused}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleMegaQuizPrimary}
                  disabled={!isConnected || presenterPaused}
                  className="flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  {megaQuizReady.is_single_segment && megaQuizModeChoice === 'skip'
                    ? 'Skip to Final Results'
                    : 'Start Mega Quiz'}
                </Button>
                <button
                  onClick={handleSkipMegaQuiz}
                  disabled={!isConnected || presenterPaused}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-dark-700 rounded transition disabled:opacity-50"
                >
                  Skip to Final Results
                </button>
              </div>
            </div>
          )}

          {/* AI Service Error Notice */}
          {aiError && event.mode === 'listen_only' && (
            <div className="mb-4">
              <AIServiceErrorNotice
                errorType={aiError.type}
                segmentTitle={segment.title || undefined}
                presenterName={segment.presenter_name}
                onRetryGeneration={() => {
                  setIsRetryingAiGeneration(true)
                  handleRestartRecording()
                }}
                onSwitchToManual={() => {
                  setAiError(null)
                  setActiveTab('add')
                }}
                onSkipSegment={handleSkipSegment}
                isRetrying={isRetryingAiGeneration}
              />
            </div>
          )}

          {/* No Questions Notice */}
          {!isQuizActive && !megaQuizReady && questions.length === 0 && !aiError &&
           (segment.status === 'quiz_ready' || segment.status === 'completed') && (
            <div className="mb-4">
              <NoQuestionsNotice
                segmentTitle={segment.title || undefined}
                presenterName={segment.presenter_name}
                onSkipSegment={handleSkipSegment}
                onRetryGeneration={
                  event.mode === 'listen_only' && segment.status === 'quiz_ready'
                    ? handleRestartRecording
                    : undefined
                }
                onAddQuestions={handleAddQuestionsManually}
                isListenOnlyMode={event.mode === 'listen_only'}
              />
            </div>
          )}

          {/* Use PresenterControls for quiz flow - only for host or current presenter */}
          {canControlPresenter && isQuizActive && quizPhase !== 'segment_complete' && quizPhase !== 'event_complete' && quizPhase !== 'mega_quiz_ready' && quizPhase !== 'presenter_paused' ? (
            <PresenterControls
              phase={quizPhase}
              questionIndex={currentQuestionIndex}
              totalQuestions={megaQuizStarted ? megaQuizQuestionCount : questions.length}
              allAnswered={allAnswered}
              onRevealAnswer={handleRevealAnswer}
              onShowLeaderboard={handleShowLeaderboard}
              onNextQuestion={handleNextQuestion}
              onEndQuiz={handleEndQuiz}
              disabled={presenterPaused}
            />
          ) : !isQuizActive && !megaQuizReady && questions.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={handleStartQuiz}
                disabled={questions.length === 0 || presenterPaused}
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
                totalParticipants={onlineParticipantCount}
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
                isHost={true}
                onPassPresenter={() => {
                  // Pass presenter button is handled inside SegmentCompleteView
                }}
                onResumeSegment={() => {
                  if (segmentId) {
                    sendMessage({ type: 'resume_segment', segment_id: segmentId })
                    setSegmentComplete(null) // Clear the complete view since we're resuming
                  }
                }}
              />
              {canControlPresenter && (
                <div className="mt-4">
                  <PassPresenterButton
                    participants={participants.map(p => ({ id: p.id, username: p.username, avatar_url: p.avatar_url }))}
                    currentUserId={user?.id || ''}
                    onPass={(nextPresenterId) => {
                      sendMessage({ type: 'pass_presenter', next_presenter_user_id: nextPresenterId })
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Questions + leaderboards */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1.5fr] gap-6 items-start">
          <div className="space-y-4">
            {/* Legacy Mode: Tabbed Question Management (for backward compatibility) */}
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

                {showManualQuestionForm && (
                  <div className="mb-4 bg-dark-900 border border-dark-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-md font-semibold text-white">Add Questions Manually</h3>
                      <button
                        className="text-sm text-gray-400 hover:text-white transition"
                        onClick={() => setShowManualQuestionForm(false)}
                      >
                        Close
                      </button>
                    </div>
                    <QuestionCreator segmentId={segment.id} onQuestionAdded={handleQuestionAdded} />
                  </div>
                )}

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

      {/* Emergency Presenter Selection Modal */}
      {presenterOverrideNeeded && canControlPresenter && (
        <EmergencyPresenterSelect
          participants={participants}
          segmentId={presenterOverrideNeeded.segmentId}
          disconnectedPresenterName={presenterOverrideNeeded.name}
          eventCode={event.join_code}
          onSelect={(presenterId, segId) => {
            sendMessage({ type: 'admin_select_presenter', presenter_user_id: presenterId, segment_id: segId })
            setPresenterOverrideNeeded(null)
            setPresenterPaused(false)
            setPresenterPausedReason(null)
          }}
          onDismiss={() => {
            setPresenterOverrideNeeded(null)
          }}
          isVisible={true}
        />
      )}

      {/* Flappy Bird during quiz generation */}
      {isGeneratingQuiz && (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center">
          <FlappyBird />
        </div>
      )}

      {/* Processing Logs Modal */}
      <ProcessingLogs
        segmentId={segmentId ?? ''}
        isOpen={showProcessingLogs}
        onClose={() => setShowProcessingLogs(false)}
      />
    </div>
  )
}


