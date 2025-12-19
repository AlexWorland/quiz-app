import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCanvasWebSocket } from '../useCanvasWebSocket';
import { MockWebSocket, setupWebSocketMock, cleanupWebSocketMock } from '@/test/mocks/websocket';

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      token: 'mock-token',
    };
    return selector(state);
  }),
}));

describe('useCanvasWebSocket', () => {
  beforeEach(() => {
    setupWebSocketMock();
  });

  afterEach(() => {
    cleanupWebSocketMock();
    vi.clearAllMocks();
  });

  it('connects on mount', () => {
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest();
    expect(ws).toBeDefined();
    expect(ws?.url).toContain('/api/ws/event/test-event');
    expect(ws?.url).toContain('token=mock-token');
  });

  it('sets isConnected when WebSocket opens', () => {
    const { result } = renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('filters canvas messages and calls onMessage', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'stroke_added',
        user_id: '1',
        username: 'user1',
        stroke: {
          points: [{ x: 10, y: 20 }],
          color: '#ff0000',
          width: 2,
        },
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'stroke_added',
      user_id: '1',
      username: 'user1',
      stroke: {
        points: [{ x: 10, y: 20 }],
        color: '#ff0000',
        width: 2,
      },
    });
  });

  it('handles canvas_cleared message', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({ type: 'canvas_cleared' });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'canvas_cleared' });
  });

  it('handles canvas_sync message', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'canvas_sync',
        strokes: [
          { points: [{ x: 10, y: 20 }], color: '#ff0000', width: 2 },
        ],
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'canvas_sync',
      strokes: [
        { points: [{ x: 10, y: 20 }], color: '#ff0000', width: 2 },
      ],
    });
  });

  it('ignores non-canvas messages', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({ type: 'game_started' });
      ws.simulateMessage({ type: 'participant_joined', user: { id: '1', username: 'user1' } });
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it('sendMessage sends draw_stroke when connected', () => {
    const { result } = renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    const sendSpy = vi.spyOn(ws, 'send');

    act(() => {
      ws.simulateOpen();
    });

    const stroke = {
      points: [{ x: 10, y: 20 }, { x: 15, y: 25 }],
      color: '#ff0000',
      width: 2,
    };

    act(() => {
      result.current.sendMessage({ type: 'draw_stroke', stroke });
    });

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: 'draw_stroke', stroke })
    );
  });

  it('sendMessage sends clear_canvas when connected', () => {
    const { result } = renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    const sendSpy = vi.spyOn(ws, 'send');

    act(() => {
      ws.simulateOpen();
    });

    act(() => {
      result.current.sendMessage({ type: 'clear_canvas' });
    });

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({ type: 'clear_canvas' })
    );
  });

  it('sendMessage warns when not connected', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', autoReconnect: false })
    );

    result.current.sendMessage({
      type: 'draw_stroke',
      stroke: { points: [], color: '#000', width: 1 },
    });

    expect(consoleSpy).toHaveBeenCalledWith('WebSocket is not connected');
    consoleSpy.mockRestore();
  });

  it('preserves stroke data through message cycle', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    const strokeData = {
      points: [
        { x: 10, y: 20 },
        { x: 15, y: 25 },
        { x: 20, y: 30 },
      ],
      color: '#ff5500',
      width: 5,
    };

    act(() => {
      ws.simulateMessage({
        type: 'stroke_added',
        user_id: '1',
        username: 'artist',
        stroke: strokeData,
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'stroke_added',
      user_id: '1',
      username: 'artist',
      stroke: strokeData,
    });

    const receivedStroke = onMessage.mock.calls[0][0].stroke;
    expect(receivedStroke.points).toHaveLength(3);
    expect(receivedStroke.color).toBe('#ff5500');
    expect(receivedStroke.width).toBe(5);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useCanvasWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
