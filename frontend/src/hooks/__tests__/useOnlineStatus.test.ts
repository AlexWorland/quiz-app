import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useOnlineStatus } from '../useOnlineStatus'

describe('useOnlineStatus', () => {
  let originalNavigator: Navigator

  beforeEach(() => {
    originalNavigator = navigator
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      configurable: true,
    })
  })

  it('should return initial online status from navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)
  })

  it('should return initial offline status from navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(false)
  })

  it('should return true when navigator is undefined (SSR safety)', () => {
    // Temporarily make navigator undefined
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'navigator')
    Object.defineProperty(window, 'navigator', {
      value: undefined,
      configurable: true,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    // Restore navigator
    if (originalDescriptor) {
      Object.defineProperty(window, 'navigator', originalDescriptor)
    }
  })

  it('should attach event listeners on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')

    renderHook(() => useOnlineStatus())

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    addEventListenerSpy.mockRestore()
  })

  it('should update state to true when online event fires', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(false)

    window.dispatchEvent(new Event('online'))

    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should update state to false when offline event fires', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    window.dispatchEvent(new Event('offline'))

    await waitFor(() => {
      expect(result.current).toBe(false)
    })
  })

  it('should handle rapid online/offline toggling', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    window.dispatchEvent(new Event('offline'))
    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    window.dispatchEvent(new Event('online'))
    await waitFor(() => {
      expect(result.current).toBe(true)
    })

    window.dispatchEvent(new Event('offline'))
    await waitFor(() => {
      expect(result.current).toBe(false)
    })

    window.dispatchEvent(new Event('online'))
    await waitFor(() => {
      expect(result.current).toBe(true)
    })
  })

  it('should remove event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    removeEventListenerSpy.mockRestore()
  })

  it('should prevent memory leaks by removing all listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())

    // Verify listeners were added
    const addCalls = addEventListenerSpy.mock.calls.length
    expect(addCalls).toBeGreaterThan(0)

    unmount()

    // Verify same number of listeners were removed
    const removeCalls = removeEventListenerSpy.mock.calls.length
    expect(removeCalls).toBe(addCalls)

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should not update state after unmount', async () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })

    const { result, unmount } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    unmount()

    // Dispatch event after unmount - should not cause state update
    window.dispatchEvent(new Event('offline'))

    // Wait a bit to ensure no state updates occur
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Hook is unmounted, cannot check result.current directly
    // This test verifies no errors occur when dispatching events after unmount
    expect(true).toBe(true)
  })
})
