import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEventWebSocket } from '../useEventWebSocket';
import { MockWebSocket, setupWebSocketMock, cleanupWebSocketMock } from '@/test/mocks/websocket';

const mockUser = { id: '1', username: 'testuser', email: 'test@example.com', role: 'participant' };
const mockState = {
  user: mockUser,
  token: 'mock-token',
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((selector) => {
    return selector(mockState);
  }),
}));

describe('useEventWebSocket', () => {
  beforeEach(() => {
    setupWebSocketMock();
  });

  afterEach(() => {
    cleanupWebSocketMock();
    vi.clearAllMocks();
  });

  it('connects on mount', () => {
    renderHook(() => useEventWebSocket({ eventId: 'test-event' }));

    const ws = MockWebSocket.getLatest();
    expect(ws).toBeDefined();
    expect(ws?.url).toContain('/api/ws/event/test-event');
    expect(ws?.url).toContain('token=mock-token');
  });

  it('sets isConnected to true when WebSocket opens', async () => {
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    expect(result.current.isConnected).toBe(false);

    const ws = MockWebSocket.getLatest()!;
    // Verify onopen handler is set
    expect(ws.onopen).toBeDefined();

    await act(async () => {
      ws.simulateOpen();
    });

    // Wait for React to process the state update
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('sends join message after connection opens', () => {
    renderHook(() => useEventWebSocket({ eventId: 'test-event' }));

    const ws = MockWebSocket.getLatest()!;
    const sendSpy = vi.spyOn(ws, 'send');

    act(() => {
      ws.simulateOpen();
    });

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'join',
        user_id: '1',
        session_code: 'test-event',
      })
    );
  });

  it('updates participants on connected message', () => {
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
    });

    act(() => {
      ws.simulateMessage({
        type: 'connected',
        participants: [
          { id: '1', username: 'user1' },
          { id: '2', username: 'user2' },
        ],
      });
    });

    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[0].username).toBe('user1');
  });

  it('adds participant on participant_joined message', () => {
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'connected',
        participants: [{ id: '1', username: 'user1' }],
      });
    });

    expect(result.current.participants).toHaveLength(1);

    act(() => {
      ws.simulateMessage({
        type: 'participant_joined',
        user: { id: '2', username: 'user2' },
      });
    });

    expect(result.current.participants).toHaveLength(2);
    expect(result.current.participants[1].username).toBe('user2');
  });

  it('removes participant on participant_left message', () => {
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({
        type: 'connected',
        participants: [
          { id: '1', username: 'user1' },
          { id: '2', username: 'user2' },
        ],
      });
    });

    expect(result.current.participants).toHaveLength(2);

    act(() => {
      ws.simulateMessage({
        type: 'participant_left',
        user_id: '1',
      });
    });

    expect(result.current.participants).toHaveLength(1);
    expect(result.current.participants[0].id).toBe('2');
  });

  it('calls onMessage callback', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useEventWebSocket({ eventId: 'test-event', onMessage })
    );

    const ws = MockWebSocket.getLatest()!;
    act(() => {
      ws.simulateOpen();
      ws.simulateMessage({ type: 'game_started' });
    });

    expect(onMessage).toHaveBeenCalledWith({ type: 'game_started' });
  });

  it('sendMessage sends data when connected', async () => {
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;

    // Open connection
    await act(async () => {
      ws.simulateOpen();
    });

    // Wait for connection to be established
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Spy on send after opening (to avoid capturing the join message)
    const sendSpy = vi.spyOn(ws, 'send');

    act(() => {
      result.current.sendMessage({ type: 'start_game' });
    });

    expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'start_game' }));
  });

  it('sendMessage warns when not connected', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event', autoReconnect: false })
    );

    result.current.sendMessage({ type: 'start_game' });

    expect(consoleSpy).toHaveBeenCalledWith('WebSocket is not connected');
    consoleSpy.mockRestore();
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() =>
      useEventWebSocket({ eventId: 'test-event' })
    );

    const ws = MockWebSocket.getLatest()!;
    const closeSpy = vi.spyOn(ws, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
