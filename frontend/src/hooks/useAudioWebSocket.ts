import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'

/**
 * Detect the best supported audio MIME type for MediaRecorder
 * Returns the first supported format, or null if none are supported
 */
function getSupportedAudioMimeType(): string | null {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ]
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  
  return null
}

export interface TranscriptUpdate {
  text: string
  is_final: boolean
}

export interface QuestionGenerated {
  question: string
  correct_answer: string
  source_transcript: string
}

export type AudioServerMessage =
  | { type: 'audio_connected'; message: string }
  | { type: 'transcript_update'; text: string; is_final: boolean }
  | { type: 'question_generated'; question: string; correct_answer: string; source_transcript: string }
  | { type: 'transcription_error'; error: string }

interface UseAudioWebSocketOptions {
  segmentId: string
  onMessage?: (message: AudioServerMessage) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  autoReconnect?: boolean
  reconnectInterval?: number
}

export function useAudioWebSocket(options: UseAudioWebSocketOptions) {
  const { segmentId, onMessage, onError, onOpen, onClose, autoReconnect = true, reconnectInterval = 3000 } = options
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const token = useAuthStore((state) => state.token)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const url = `${WS_URL}/api/ws/audio/${segmentId}?token=${token}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setIsConnected(true)
      onOpen?.()
    }

    ws.onmessage = (event) => {
      try {
        const message: AudioServerMessage = JSON.parse(event.data)
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
  }, [segmentId, token, onMessage, onError, onOpen, onClose, autoReconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    stopRecording()
    wsRef.current?.close()
    wsRef.current = null
    setIsConnected(false)
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Detect supported audio MIME type with fallback
      const supportedMimeType = getSupportedAudioMimeType()
      if (!supportedMimeType) {
        throw new Error('No supported audio format found in this browser')
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
      })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send audio chunk as binary
          wsRef.current.send(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        // Send stop message
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'audio_stop' }))
        }
      }

      mediaRecorder.start(1000) // Send chunks every second
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
    } catch (error) {
      console.error('Failed to start recording:', error)
      onError?.(error as Event)
    }
  }, [onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    startRecording,
    stopRecording,
    connect,
    disconnect,
  }
}

