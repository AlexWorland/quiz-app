import { useEffect, useRef, useState, useCallback } from 'react'

interface ReconnectionConfig {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

interface ReconnectionState {
  isReconnecting: boolean
  attemptCount: number
  nextAttemptIn: number
  hasGivenUp: boolean
}

const DEFAULT_CONFIG: Required<ReconnectionConfig> = {
  maxAttempts: 10,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
}

export function useReconnection(
  onReconnect: () => void,
  shouldReconnect: boolean,
  config: ReconnectionConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const [state, setState] = useState<ReconnectionState>({
    isReconnecting: false,
    attemptCount: 0,
    nextAttemptIn: 0,
    hasGivenUp: false,
  })

  const attemptCountRef = useRef(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const calculateDelay = useCallback(
    (attempt: number): number => {
      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      )
      return delay
    },
    [finalConfig.initialDelay, finalConfig.backoffMultiplier, finalConfig.maxDelay]
  )

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    cleanup()
    attemptCountRef.current = 0
    setState({
      isReconnecting: false,
      attemptCount: 0,
      nextAttemptIn: 0,
      hasGivenUp: false,
    })
  }, [cleanup])

  const attemptReconnection = useCallback(() => {
    if (attemptCountRef.current >= finalConfig.maxAttempts) {
      setState((prev) => ({ ...prev, hasGivenUp: true, isReconnecting: false }))
      cleanup()
      return
    }

    const attempt = attemptCountRef.current
    const delay = calculateDelay(attempt)

    setState((prev) => ({
      ...prev,
      isReconnecting: true,
      attemptCount: attempt + 1,
      nextAttemptIn: delay,
    }))

    // Start countdown
    const countdownStart = Date.now()
    countdownRef.current = setInterval(() => {
      const elapsed = Date.now() - countdownStart
      const remaining = Math.max(0, delay - elapsed)
      setState((prev) => ({ ...prev, nextAttemptIn: remaining }))
    }, 100)

    // Schedule reconnection attempt
    timeoutRef.current = setTimeout(() => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
      attemptCountRef.current++
      onReconnect()
    }, delay)
  }, [finalConfig.maxAttempts, calculateDelay, cleanup, onReconnect])

  useEffect(() => {
    if (shouldReconnect && !state.hasGivenUp) {
      attemptReconnection()
    } else if (!shouldReconnect) {
      reset()
    }

    return cleanup
  }, [shouldReconnect, state.hasGivenUp, attemptReconnection, reset, cleanup])

  return {
    ...state,
    reset,
    nextAttemptSeconds: Math.ceil(state.nextAttemptIn / 1000),
  }
}

