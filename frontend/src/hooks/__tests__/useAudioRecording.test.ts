import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAudioRecording } from '../useAudioRecording'

describe('useAudioRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should start and stop recording', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([
        { stop: vi.fn() }
      ])
    }
    
    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null as any,
      onstop: null as any,
      state: 'inactive'
    }

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      writable: true,
      configurable: true
    })

    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any

    const { result } = renderHook(() => useAudioRecording())

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)
    expect(mockMediaRecorder.start).toHaveBeenCalledWith(1000)

    act(() => {
      result.current.stopRecording()
    })

    expect(mockMediaRecorder.stop).toHaveBeenCalled()
  })

  it('should handle microphone access denied', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied'))
      },
      writable: true,
      configurable: true
    })

    const { result } = renderHook(() => useAudioRecording())

    await act(async () => {
      try {
        await result.current.startRecording()
      } catch (err) {
        // Error is expected - state should update
      }
    })

    expect(result.current.error).toBe('Microphone access denied or not available')
  })

  it('should clear recording', () => {
    const { result } = renderHook(() => useAudioRecording())

    act(() => {
      result.current.clearRecording()
    })

    expect(result.current.audioBlob).toBeNull()
  })
})

