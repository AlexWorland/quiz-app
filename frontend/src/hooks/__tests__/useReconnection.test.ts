import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useReconnection } from '../useReconnection'

describe('useReconnection', () => {
  it('should not reconnect when shouldReconnect is false', () => {
    const onReconnect = vi.fn()
    const { result } = renderHook(() =>
      useReconnection(onReconnect, false)
    )

    expect(result.current.isReconnecting).toBe(false)
    expect(result.current.attemptCount).toBe(0)
    expect(onReconnect).not.toHaveBeenCalled()
  })

  it('should start reconnection when shouldReconnect is true', async () => {
    const onReconnect = vi.fn()
    const { result } = renderHook(() =>
      useReconnection(onReconnect, true, {
        initialDelay: 50,
      })
    )

    // Should start reconnecting immediately
    await waitFor(() => {
      expect(result.current.isReconnecting).toBe(true)
    }, { timeout: 100 })

    expect(result.current.attemptCount).toBeGreaterThan(0)
  })

  it('should call onReconnect callback', async () => {
    const onReconnect = vi.fn()
    renderHook(() =>
      useReconnection(onReconnect, true, {
        initialDelay: 50,
      })
    )

    // Should call reconnect at least once
    await waitFor(() => {
      expect(onReconnect).toHaveBeenCalled()
    }, { timeout: 200 })
  })

  it('should track attempt count', async () => {
    const onReconnect = vi.fn()
    const { result } = renderHook(() =>
      useReconnection(onReconnect, true, {
        initialDelay: 50,
      })
    )

    await waitFor(() => {
      expect(result.current.attemptCount).toBeGreaterThanOrEqual(1)
    }, { timeout: 200 })
  })

  it('should reset when shouldReconnect becomes false', async () => {
    const onReconnect = vi.fn()
    const { result, rerender } = renderHook(
      ({ shouldReconnect }) => useReconnection(onReconnect, shouldReconnect, { initialDelay: 50 }),
      { initialProps: { shouldReconnect: true } }
    )

    // Start reconnecting
    await waitFor(() => {
      expect(result.current.isReconnecting).toBe(true)
    }, { timeout: 200 })

    // Stop reconnecting
    rerender({ shouldReconnect: false })

    await waitFor(() => {
      expect(result.current.isReconnecting).toBe(false)
    }, { timeout: 200 })
  })

  it('should provide countdown information', async () => {
    const onReconnect = vi.fn()
    const { result } = renderHook(() =>
      useReconnection(onReconnect, true, {
        initialDelay: 500,
      })
    )

    // Should provide nextAttemptSeconds
    await waitFor(() => {
      expect(result.current.nextAttemptSeconds).toBeGreaterThanOrEqual(0)
    }, { timeout: 200 })
  })
})

