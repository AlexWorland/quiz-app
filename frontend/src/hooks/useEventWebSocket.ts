import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

export interface Participant {
  id: string
  username: string
  avatar_url?: string
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
}

export type ServerMessage =
  | { type: 'connected'; participants: Participant[] }
  | { type: 'participant_joined'; user: Participant }
  | { type: 'participant_left'; user_id: string }
  | { type: 'game_started' }
  | { type: 'question'; question_id: string; text: string; answers: string[]; time_limit: number }
  | { type: 'time_update'; remaining_seconds: number }
  | { type: 'answer_received'; user_id: string }
  | { type: 'reveal'; correct_answer: string; distribution: AnswerDistribution[]; segment_leaderboard: LeaderboardEntry[]; event_leaderboard: LeaderboardEntry[] }
  | { type: 'scores_update'; scores: Array<{ user_id: string; username: string; score: number; delta: number }> }
  | { type: 'leaderboard'; rankings: LeaderboardEntry[] }
  | { type: 'game_ended' }
  | { type: 'error'; message: string }

export type GameMessage =
  | { type: 'join'; user_id: string; session_code: string }
  | { type: 'answer'; question_id: string; selected_answer: string; response_time_ms: number }
  | { type: 'start_game' }
  | { type: 'next_question' }
  | { type: 'reveal_answer' }
  | { type: 'show_leaderboard' }
  | { type: 'end_game' }

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
  const { eventId, onMessage, onError, onOpen, onClose, autoReconnect = true, reconnectInterval = 3000 } = options
  const [isConnected, setIsConnected] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
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
        
        // Update participants if connected message
        if (message.type === 'connected') {
          setParticipants(message.participants)
        } else if (message.type === 'participant_joined') {
          setParticipants((prev) => [...prev, message.user])
        } else if (message.type === 'participant_left') {
          setParticipants((prev) => prev.filter((p) => p.id !== message.user_id))
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

      // Auto-reconnect if enabled
      if (autoReconnect) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }

    wsRef.current = ws
  }, [eventId, token, user, onMessage, onError, onOpen, onClose, autoReconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
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
    sendMessage,
    connect,
    disconnect,
  }
}

