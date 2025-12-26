import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChunkedAudioRecording } from '../useChunkedAudioRecording'

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ token: 'test-token' }))
}))

describe('useChunkedAudioRecording', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('should upload chunks every minute during recording', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
    }
    
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      writable: true,
      configurable: true
    })

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null as any,
      onstop: null as any,
      state: 'inactive'
    }

    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, chunk_index: 0 })
    } as any)

    const onChunkUploaded = vi.fn()
    const { result } = renderHook(() => 
      useChunkedAudioRecording({
        segmentId: 'test-segment',
        onChunkUploaded
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    expect(result.current.isRecording).toBe(true)
    expect(mockMediaRecorder.start).toHaveBeenCalledWith(60000) // 1 minute

    // Simulate chunk available
    await act(async () => {
      const blob = new Blob(['chunk data'], { type: 'audio/webm' })
      if (mockMediaRecorder.ondataavailable) {
        await mockMediaRecorder.ondataavailable({ data: blob } as any)
      }
    })

    await waitFor(() => {
      expect(onChunkUploaded).toHaveBeenCalledWith({
        chunkIndex: 0,
        success: true
      })
    })
  })

  it('should track number of chunks uploaded', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
    }
    
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      writable: true,
      configurable: true
    })

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null as any,
      onstop: null as any,
      state: 'inactive'
    }

    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    } as any)

    const { result } = renderHook(() => 
      useChunkedAudioRecording({ segmentId: 'test-segment' })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    // Simulate first chunk
    await act(async () => {
      const blob = new Blob(['chunk 1'], { type: 'audio/webm' })
      if (mockMediaRecorder.ondataavailable) {
        await mockMediaRecorder.ondataavailable({ data: blob } as any)
      }
    })

    await waitFor(() => {
      expect(result.current.chunksUploaded).toBe(1)
    })
  })

  it('should handle chunk upload failures and retry', async () => {
    const mockStream = {
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }])
    }
    
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream)
      },
      writable: true,
      configurable: true
    })

    const mockMediaRecorder = {
      start: vi.fn(),
      stop: vi.fn(),
      ondataavailable: null as any,
      onstop: null as any,
      state: 'inactive'
    }

    global.MediaRecorder = vi.fn().mockImplementation(() => mockMediaRecorder) as any
    
    // First call fails, second succeeds
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      } as any)

    const onError = vi.fn()
    const { result } = renderHook(() => 
      useChunkedAudioRecording({
        segmentId: 'test-segment',
        onError
      })
    )

    await act(async () => {
      await result.current.startRecording()
    })

    // Simulate chunk - should retry on failure
    await act(async () => {
      const blob = new Blob(['chunk data'], { type: 'audio/webm' })
      if (mockMediaRecorder.ondataavailable) {
        await mockMediaRecorder.ondataavailable({ data: blob } as any)
      }
    })

    // Should eventually succeed after retry
    await waitFor(() => {
      expect(result.current.chunksUploaded).toBe(1)
    }, { timeout: 10000 })
  })
})

