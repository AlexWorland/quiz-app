# TICKET-012: QR Lock/Unlock Controls - Frontend UI

**Priority:** 🟡 HIGH
**Effort:** 1.5 hours
**Status:** Pending
**Depends On:** TICKET-011

---

## Description

Add lock/unlock button to EventHost header and show QR lock status indicator.

## Files to Modify

### 1. `frontend/src/pages/EventHost.tsx`

Add lock state tracking and UI button:

```typescript
import { useState, useEffect } from 'react';
import { useEventWebSocket } from '../hooks/useEventWebSocket';

export function EventHost() {
  const [qrLocked, setQrLocked] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const { send, onMessage } = useEventWebSocket(eventId);

  // Listen for QR lock status updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'qr_locked') {
        setQrLocked(message.locked);
        setIsLocking(false);
      }
    };

    onMessage(handleMessage);
  }, [onMessage]);

  // Fetch initial QR lock status
  useEffect(() => {
    const fetchQRStatus = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        const event = await response.json();
        setQrLocked(event.qr_locked);
      } catch (error) {
        console.error('Failed to fetch QR status:', error);
      }
    };

    fetchQRStatus();
  }, [eventId]);

  const handleToggleQRLock = async () => {
    try {
      setIsLocking(true);
      const messageType = qrLocked ? 'unlock_qr' : 'lock_qr';
      send({ type: messageType });
      // Loading state persists until QRLocked message received
    } catch (error) {
      console.error('Failed to toggle QR lock:', error);
      setIsLocking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header with QR Lock Controls */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title */}
            <div>
              <h1 className="text-2xl font-bold text-white">Event Host</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your quiz event</p>
            </div>

            {/* QR Lock Controls */}
            <div className="flex items-center gap-4">
              {/* Lock Status Badge */}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  qrLocked
                    ? 'bg-red-500/20 border border-red-500/50'
                    : 'bg-green-500/20 border border-green-500/50'
                }`}
              >
                {qrLocked ? (
                  <svg
                    className="w-4 h-4 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a5 5 0 015 5v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2V7a5 5 0 015-5zm-4 9a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
                  </svg>
                )}
                <span className={`text-xs font-medium ${
                  qrLocked ? 'text-red-300' : 'text-green-300'
                }`}>
                  {qrLocked ? 'QR Locked' : 'QR Open'}
                </span>
              </div>

              {/* Toggle Button */}
              <button
                onClick={handleToggleQRLock}
                disabled={isLocking}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  qrLocked
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-700'
                } text-white disabled:opacity-50`}
              >
                {isLocking ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    {qrLocked ? 'Unlocking...' : 'Locking...'}
                  </span>
                ) : qrLocked ? (
                  'Unlock QR'
                ) : (
                  'Lock QR'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner when QR is Locked */}
      {qrLocked && (
        <div className="bg-red-500/20 border-b border-red-500/50">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <p className="text-red-300 text-sm">
              ⛔ QR code joining is locked. New participants cannot join the event.
            </p>
          </div>
        </div>
      )}

      {/* Rest of event host UI */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Event content */}
      </div>
    </div>
  );
}
```

### 2. `frontend/src/pages/JoinEvent.tsx`

Show error when QR is locked:

```typescript
// In handleJoinEvent error handling:

catch (error) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 409) {
      const message = error.response?.data?.detail || 'Cannot join event';
      if (message.includes('locked')) {
        setError('QR joining is temporarily locked by the event host. Please try again later.');
      } else if (message.includes('already joined')) {
        setError('This device has already joined this event');
      } else {
        setError(message);
      }
    } else {
      setError(error.message);
    }
  }
}
```

## Acceptance Criteria

- [ ] Lock/unlock button added to EventHost header
- [ ] Lock status badge displays (red for locked, green for open)
- [ ] Lock/unlock icons match status (lock icon when open, unlock icon when locked)
- [ ] Button sends correct WebSocket message
- [ ] Loading state shown during lock/unlock
- [ ] Status updates in real-time when message received
- [ ] Info banner shows when QR locked
- [ ] Error message shown to participants trying to join locked event
- [ ] Host-only control (no button for participants)
- [ ] Mobile-responsive design
- [ ] No TypeScript errors

## Testing

1. **Manual Testing:**
   - Click lock button - should show "Locking..."
   - After lock, button should show "Unlock QR"
   - Badge should turn red
   - Info banner should appear
   - Try joining from participant side - should get error

2. **State Persistence:**
   - Refresh page as host - lock state should persist
   - Close/reopen - status should reload from server

3. **Multi-tab:**
   - Lock in one tab
   - Other tab should update in real-time via WebSocket

## Dependencies

- TICKET-011: Backend handlers

## Related Tickets

- TICKET-011: Backend handlers
- TICKET-010: Database schema

## Notes

- Button label changes based on current state
- Loading spinner prevents multiple clicks
- Info banner is non-intrusive but visible
- Icon choices make status immediately clear
