# TICKET-003: Device/Session Identity - Frontend Join Flow

**Priority:** 🔴 CRITICAL
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-001, TICKET-002

---

## Description

Implement frontend device tracking: calculate device fingerprint, store session tokens, and pass device credentials when joining events.

## Files to Modify

### 1. `frontend/src/utils/deviceFingerprint.ts` (NEW FILE)

```typescript
import crypto from 'crypto-js';

export interface DeviceInfo {
  userAgent: string;
  acceptLanguage: string;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    userAgent: navigator.userAgent,
    acceptLanguage: navigator.language,
  };
}

export function generateDeviceFingerprint(deviceInfo: DeviceInfo): string {
  const input = `${deviceInfo.userAgent}|${deviceInfo.acceptLanguage}`;
  return crypto.SHA256(input).toString();
}

export function getOrCreateDeviceFingerprint(): string {
  // Check localStorage for existing fingerprint
  let fingerprint = localStorage.getItem('device_fingerprint');

  if (!fingerprint) {
    // Generate new fingerprint
    const deviceInfo = getDeviceInfo();
    fingerprint = generateDeviceFingerprint(deviceInfo);
    localStorage.setItem('device_fingerprint', fingerprint);
  }

  return fingerprint;
}
```

### 2. `frontend/src/store/authStore.ts`

Add device tracking to Zustand store:

```typescript
interface AuthState {
  // ... existing fields
  deviceId: string | null;
  sessionToken: string | null;

  setDeviceInfo: (deviceId: string, sessionToken: string) => void;
  clearDeviceInfo: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // ... existing state
  deviceId: localStorage.getItem('device_id'),
  sessionToken: localStorage.getItem('session_token'),

  setDeviceInfo: (deviceId: string, sessionToken: string) => {
    localStorage.setItem('device_id', deviceId);
    localStorage.setItem('session_token', sessionToken);
    set({ deviceId, sessionToken });
  },

  clearDeviceInfo: () => {
    localStorage.removeItem('device_id');
    localStorage.removeItem('session_token');
    set({ deviceId: null, sessionToken: null });
  },
}));
```

### 3. `frontend/src/api/endpoints.ts`

Update join event endpoint:

```typescript
export interface JoinEventRequest {
  code: string;
  deviceFingerprint: string;
}

export interface JoinEventResponse {
  eventId: string;
  deviceId: string;
  sessionToken: string;
  status: string;
}

export const joinEvent = async (
  code: string,
  deviceFingerprint: string
): Promise<JoinEventResponse> => {
  try {
    const response = await client.post<JoinEventResponse>(
      `/events/join/${code}`,
      { code, deviceFingerprint }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      throw new Error('This device has already joined this event');
    }
    throw error;
  }
};
```

### 4. `frontend/src/pages/JoinEvent.tsx`

Update join handler:

```typescript
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { joinEvent } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export function JoinEvent() {
  const setDeviceInfo = useAuthStore((state) => state.setDeviceInfo);
  const navigate = useNavigate();

  const handleJoinSuccess = async (code: string) => {
    try {
      const deviceFingerprint = getOrCreateDeviceFingerprint();

      const response = await joinEvent(code, deviceFingerprint);

      // Store device info in auth store
      setDeviceInfo(response.deviceId, response.sessionToken);

      // Navigate to event
      navigate(`/events/${response.eventId}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already joined')) {
          // Show error: device already joined
          setError('This device has already joined. Choose a different device or wait for the event to end.');
        } else {
          setError(error.message);
        }
      }
    }
  };

  return (
    // Updated JSX will come in TICKET-004 when implementing QR scanner
    <div>Join Event Page</div>
  );
}
```

### 5. `frontend/src/hooks/useEventWebSocket.ts`

Pass device credentials to WebSocket:

```typescript
export function useEventWebSocket(eventId: string) {
  const deviceId = useAuthStore((state) => state.deviceId);
  const sessionToken = useAuthStore((state) => state.sessionToken);

  const connect = useCallback(() => {
    const wsUrl = new URL(`${import.meta.env.VITE_WS_URL}/api/ws/event/${eventId}`);

    // Add device credentials to URL
    if (deviceId && sessionToken) {
      wsUrl.searchParams.append('device_id', deviceId);
      wsUrl.searchParams.append('session_token', sessionToken);
    }

    const ws = new WebSocket(wsUrl.toString());
    // ... rest of connection logic
  }, [eventId, deviceId, sessionToken]);

  return { /* ... */ };
}
```

### 6. `frontend/src/api/client.ts`

Add device headers to axios interceptor:

```typescript
client.interceptors.request.use((config) => {
  const deviceId = localStorage.getItem('device_id');
  const sessionToken = localStorage.getItem('session_token');

  if (deviceId && sessionToken) {
    config.headers['X-Device-ID'] = deviceId;
    config.headers['X-Session-Token'] = sessionToken;
  }

  return config;
});
```

## Acceptance Criteria

- [ ] Device fingerprint utility created and working
- [ ] Device fingerprint persisted in localStorage
- [ ] Auth store tracks device_id and session_token
- [ ] Join event endpoint sends device fingerprint
- [ ] Device info stored after successful join
- [ ] WebSocket includes device credentials
- [ ] Axios interceptor adds device headers
- [ ] Error handling for "already joined" scenario
- [ ] Code compiles without warnings
- [ ] Device fingerprint consistent across page reloads

## Testing

```bash
cd frontend
npm test -- deviceFingerprint.test.ts
npm test -- authStore.test.ts
```

## Error Handling

Handle these responses:
- `409 Conflict`: "This device has already joined this event"
- `401 Unauthorized`: "Invalid device credentials"

## Dependencies

- TICKET-001: Database schema
- TICKET-002: Backend handlers

## Related Tickets

- TICKET-004: Remove manual code entry (frontend will redirect to QR scanner)
- TICKET-005: Add QR scanner component
- TICKET-013: Network loss resilience will use these credentials

## Notes

- Device fingerprint is consistent across sessions but changes if browser is cleared
- Users on shared device will have same fingerprint = blocking duplicate join is intentional
- If user wants to rejoin, they must use a different device or wait for previous session to timeout
