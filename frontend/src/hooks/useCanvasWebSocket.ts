import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

export interface Point {
  x: number
  y: number
}

export interface StrokeData {
  points: Point[]
  color: string
  width: number
}

export type CanvasServerMessage =
  | { type: 'stroke_added'; user_id: string; username: string; stroke: StrokeData }
  | { type: 'canvas_cleared' }
  | { type: 'canvas_sync'; strokes: StrokeData[] }

export type CanvasMessage =
  | { type: 'draw_stroke'; stroke: StrokeData }
  | { type: 'clear_canvas' }

interface UseCanvasWebSocketOptions {
  eventId: string
  onMessage?: (message: CanvasServerMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useCanvasWebSocket(options: UseCanvasWebSocketOptions) {
  const { eventId, onMessage, onError, onOpen, onClose, autoReconnect = true, reconnectInterval = 3000 } = options
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // Use the same event WebSocket for canvas messages
    const url = `${WS_URL}/api/ws/event/${eventId}?token=${token}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setIsConnected(true)
      onOpen?.()
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Filter for canvas messages
        if (data.type === 'stroke_added' || data.type === 'canvas_cleared' || data.type === 'canvas_sync') {
          const message: CanvasServerMessage = data
          onMessage?.(message)
        }
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
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }

    wsRef.current = ws
  }, [eventId, token, onMessage, onError, onOpen, onClose, autoReconnect, reconnectInterval])

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
    (message: CanvasMessage) => {
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
    sendMessage,
    connect,
    disconnect,
  }
}

