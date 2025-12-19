import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAudioWebSocket, detectAudioCapabilities } from '../useAudioWebSocket';
import { MockWebSocket, setupWebSocketMock, cleanupWebSocketMock } from '@/test/mocks/websocket';

// Get reference to the global MockMediaRecorder
const MockMediaRecorder = (global as any).MediaRecorder;

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      token: 'mock-token',
    };
    return selector(state);
  }),
}));

describe('useAudioWebSocket', () => {
  beforeEach(() => {
    setupWebSocketMock();
    // MediaRecorder is already set up globally in test/setup.ts
    // Just reset instances
    (global as any).MediaRecorder.instances = [];
  });

  afterEach(() => {
    cleanupWebSocketMock();
    (global as any).MediaRecorder.instances = [];
    vi.clearAllMocks();
  });

  describe('detectAudioCapabilities', () => {
    it('returns optimal format when WebM Opus is supported', () => {
      const result = detectAudioCapabilities();
      expect(result).toEqual({
        mimeType: 'audio/webm;codecs=opus',
        isOptimal: true,
      });
    });

    it('returns fallback format with warning when optimal not supported', () => {
      const originalIsTypeSupported = MockMediaRecorder.isTypeSupported;
      MockMediaRecorder.isTypeSupported = (type: string) => type === 'audio/webm';
      (global as any).MediaRecorder.isTypeSupported = MockMediaRecorder.isTypeSupported;

      const result = detectAudioCapabilities();
      expect(result).toEqual({
        mimeType: 'audio/webm',
        isOptimal: false,
        warning: 'Using WebM without Opus codec (may have compatibility issues)',
      });

      MockMediaRecorder.isTypeSupported = originalIsTypeSupported;
      (global as any).MediaRecorder.isTypeSupported = originalIsTypeSupported;
    });

    it('returns null when no format is supported', () => {
      const originalIsTypeSupported = MockMediaRecorder.isTypeSupported;
      MockMediaRecorder.isTypeSupported = () => false;
      (global as any).MediaRecorder.isTypeSupported = MockMediaRecorder.isTypeSupported;

      const result = detectAudioCapabilities();
      expect(result).toBeNull();

      MockMediaRecorder.isTypeSupported = originalIsTypeSupported;
      (global as any).MediaRecorder.isTypeSupported = originalIsTypeSupported;
    });
  });

  it('detects audio capabilities on mount', () => {
    const { result } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    expect(result.current.audioCapabilities).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      isOptimal: true,
    });
  });

  it('connects on mount', () => {
    renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    const ws = MockWebSocket.getLatest();
    expect(ws).toBeDefined();
    expect(ws?.url).toContain('/api/ws/audio/test-segment');
    expect(ws?.url).toContain('token=mock-token');
  });

  it('sets isConnected when WebSocket opens', () => {
    const { result } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('startRecording requests user media and starts MediaRecorder', async () => {
    const { result } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    const recorder = MockMediaRecorder.instances[MockMediaRecorder.instances.length - 1];
    expect(recorder).toBeDefined();
    expect(recorder.state).toBe('recording');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });

  it('stopRecording stops MediaRecorder', async () => {
    const { result } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    const recorder = MockMediaRecorder.instances[MockMediaRecorder.instances.length - 1];
    expect(recorder.state).toBe('recording');

    act(() => {
      result.current.stopRecording();
    });

    expect(recorder.state).toBe('inactive');
  });

  it('handles getUserMedia permission denied', async () => {
    const onError = vi.fn();
    const mockError = new Error('Permission denied');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment', onError })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    expect(onError).toHaveBeenCalled();
  });

  it('calls onMessage for transcript updates', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'transcript_update',
        text: 'Hello world',
        is_final: false,
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'transcript_update',
      text: 'Hello world',
      is_final: false,
    });
  });

  it('cleans up on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useAudioWebSocket({ segmentId: 'test-segment' })
    );

    const ws = MockWebSocket.getLatest()!;
    const closeSpy = vi.spyOn(ws, 'close');
    act(() => {
      ws.simulateOpen();
    });

    await act(async () => {
      await result.current.startRecording();
    });

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
