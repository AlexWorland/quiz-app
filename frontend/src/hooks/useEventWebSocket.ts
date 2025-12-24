import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useReconnection } from './useReconnection'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

export interface Participant {
  id: string
  username: string
  avatar_url?: string
  join_status?: string
  is_late_joiner?: boolean
  joined_at?: string
  online?: boolean
}

export interface Question {
  question_id: string
  text: string
  answers: string[]
  time_limit: number
}

export interface AnswerDistribution {
  answer: string
  count: number
  is_correct: boolean
}

export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
  /** Whether this participant joined after the quiz started */
  is_late_joiner?: boolean
  response_time_ms?: number
}

export interface SegmentWinner {
  segment_id: string
  segment_title: string
  winner_name: string
  winner_score: number
}

export type QuizPhase =
  | 'not_started'
  | 'showing_question'
  | 'revealing_answer'
  | 'showing_leaderboard'
  | 'between_questions'
  | 'segment_complete'
  | 'mega_quiz_ready'
  | 'mega_quiz'
  | 'event_complete'
  | 'presenter_paused'

export type ServerMessage =
  | { type: 'connected'; participants: Participant[] }
  | { type: 'participant_joined'; user: Participant }
  | { type: 'participant_left'; user_id: string; online?: boolean }
  | { type: 'participant_name_changed'; user_id: string; old_name: string; new_name: string }
  | { type: 'join_lock_status_changed'; event_id: string; join_locked: boolean; locked_at?: string; message: string }
  | { type: 'game_started' }
  | { type: 'question'; question_id: string; question_number: number; total_questions: number; text: string; answers: string[]; time_limit: number }
  | { type: 'time_update'; remaining_seconds: number }
  | { type: 'answer_received'; user_id: string }
  | { type: 'reveal'; question_id: string; question_number: number; question_text: string; correct_answer: string; distribution: AnswerDistribution[]; segment_leaderboard: LeaderboardEntry[]; event_leaderboard: LeaderboardEntry[] }
  | { type: 'scores_update'; scores: Array<{ user_id: string; username: string; score: number; delta: number }> }
  | { type: 'leaderboard'; rankings: LeaderboardEntry[] }
  | { type: 'game_ended' }
  | { type: 'error'; message: string }
  | { type: 'processing_status'; step: string; progress?: number; message: string }
  | { type: 'display_mode'; mode: string; data: unknown }
  | { type: 'phase_changed'; phase: QuizPhase; question_index: number; total_questions: number }
  | { type: 'all_answered'; answer_count: number; total_participants: number }
  | { type: 'presenter_changed'; previous_presenter_id: string; new_presenter_id: string; new_presenter_name: string; segment_id: string }
  | { type: 'presenter_disconnected'; presenter_id: string; presenter_name: string; segment_id: string }
  | { type: 'presenter_paused'; presenter_id: string; presenter_name: string; segment_id: string; question_index: number; total_questions: number; reason?: string }
  | { type: 'presenter_override_needed'; presenter_id: string; presenter_name: string; segment_id: string }
  | { type: 'segment_complete'; segment_id: string; segment_title: string; presenter_name: string; segment_leaderboard: LeaderboardEntry[]; event_leaderboard: LeaderboardEntry[]; segment_winner?: LeaderboardEntry; event_leader?: LeaderboardEntry }
  | { type: 'event_complete'; event_id: string; final_leaderboard: LeaderboardEntry[]; winner?: LeaderboardEntry; segment_winners: SegmentWinner[] }
  | {
      type: 'mega_quiz_ready'
      event_id: string
      available_questions: number
      current_leaderboard: LeaderboardEntry[]
      is_single_segment?: boolean
      single_segment_mode?: 'remix' | 'skip'
    }
  | { type: 'mega_quiz_started'; event_id: string; question_count: number }
  | { type: 'ping' }
  | {
      type: 'state_restored'
      event_id: string
      segment_id?: string
      current_phase: QuizPhase
      current_question_id?: string
      question_text?: string
      answers?: string[]
      time_limit?: number
      question_started_at?: string
      your_score: number
      your_answer?: string
      participants: Participant[]
    }

export type GameMessage =
  | { type: 'join'; user_id: string; session_code: string }
  | { type: 'answer'; question_id: string; selected_answer: string; response_time_ms: number }
  | { type: 'start_game' }
  | { type: 'next_question' }
  | { type: 'reveal_answer' }
  | { type: 'show_leaderboard' }
  | { type: 'end_game' }
  | { type: 'pass_presenter'; next_presenter_user_id: string }
  | { type: 'admin_select_presenter'; presenter_user_id: string; segment_id: string }
  | { type: 'resume_segment'; segment_id: string }
  | { type: 'start_mega_quiz'; question_count?: number }
  | { type: 'skip_mega_quiz' }

interface UseEventWebSocketOptions {
  eventId: string
  onMessage?: (message: ServerMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useEventWebSocket(options: UseEventWebSocketOptions) {
  const { eventId, onMessage, onError, onOpen, onClose, autoReconnect = true } = options
  const [isConnected, setIsConnected] = useState(false)
  const [shouldReconnect, setShouldReconnect] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [currentPresenter, setCurrentPresenter] = useState<{ id: string; name: string } | null>(null)
  const [isPresenter, setIsPresenter] = useState(false)
  const [presenterPaused, setPresenterPaused] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const url = `${WS_URL}/api/ws/event/${eventId}?token=${token}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setIsConnected(true)
      setShouldReconnect(false) // Stop reconnection attempts
      onOpen?.()

      // Send join message
      if (user) {
        ws.send(
          JSON.stringify({
            type: 'join',
            user_id: user.id,
            session_code: eventId,
          })
        )
      }
    }

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        
        // Handle ping/pong for heartbeat
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }
        
        // Handle state restoration on reconnection
        if (message.type === 'state_restored') {
          // State will be handled by the parent component through onMessage
          // This gives the parent full control over state restoration
          onMessage?.(message)
          return
        }
        
        // Update participants if connected message
        if (message.type === 'connected') {
          setParticipants(message.participants)
        } else if (message.type === 'participant_joined') {
          setParticipants((prev) => [...prev, { ...message.user, online: true }])
        } else if (message.type === 'participant_left') {
          setParticipants((prev) => prev.filter((p) => p.id !== message.user_id))
        } else if (message.type === 'presenter_changed') {
          // Update current presenter info
          setCurrentPresenter({
            id: message.new_presenter_id,
            name: message.new_presenter_name
          })
          setPresenterPaused(false)
          // Check if current user is the new presenter
          if (user && message.new_presenter_id === user.id) {
            setIsPresenter(true)
          } else if (user && message.previous_presenter_id === user.id) {
            setIsPresenter(false)
          }
        } else if (message.type === 'phase_changed') {
          setPresenterPaused(message.phase === 'presenter_paused')
        } else if (message.type === 'presenter_paused') {
          setPresenterPaused(true)
          setCurrentPresenter({
            id: message.presenter_id,
            name: message.presenter_name
          })
        }

        onMessage?.(message)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      onError?.(error)
    }

    ws.onclose = () => {
      setIsConnected(false)
      onClose?.()

      // Trigger reconnection via exponential backoff
      if (autoReconnect) {
        setShouldReconnect(true)
      }
    }

    wsRef.current = ws
  }, [eventId, token, user, onMessage, onError, onOpen, onClose, autoReconnect])

  // Use reconnection hook for exponential backoff (defined after connect)
  const reconnection = useReconnection(
    connect,
    shouldReconnect && autoReconnect
  )

  const disconnect = useCallback(() => {
    setShouldReconnect(false) // Stop any reconnection attempts
    wsRef.current?.close()
    wsRef.current = null
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback(
    (message: GameMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message))
      } else {
        console.warn('WebSocket is not connected')
      }
    },
    []
  )

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    participants,
    currentPresenter,
    isPresenter,
    presenterPaused,
    sendMessage,
    connect,
    disconnect,
    reconnection, // Include reconnection state for UI display
  }
}

