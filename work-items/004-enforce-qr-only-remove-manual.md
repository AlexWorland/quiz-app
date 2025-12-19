# TICKET-004: Enforce QR-Only Entry - Remove Manual Code Entry

**Priority:** 🔴 CRITICAL
**Effort:** 1-1.5 hours
**Status:** Pending
**Depends On:** None

---

## Description

Remove manual code entry UI from JoinEvent page to enforce QR-code-only joining (as per user stories). Keep URL parameter support for backwards compatibility during development.

## Files to Modify

### 1. `frontend/src/pages/JoinEvent.tsx`

**Current State:**
- Text input for 6-character code
- Manual "Join" button
- Optional URL parameter support for code

**Changes:**

```typescript
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { joinEvent } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export function JoinEvent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const setDeviceInfo = useAuthStore((state) => state.setDeviceInfo);

  // Auto-join if code in URL (for backwards compatibility during transition)
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      handleJoinEvent(codeFromUrl);
    }
  }, [searchParams]);

  const handleJoinEvent = async (code: string) => {
    try {
      const deviceFingerprint = getOrCreateDeviceFingerprint();
      const response = await joinEvent(code, deviceFingerprint);
      setDeviceInfo(response.deviceId, response.sessionToken);
      navigate(`/events/${response.eventId}`);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already joined')) {
          setError('This device has already joined this event');
        } else if (error.message.includes('not found')) {
          setError('Event not found. Make sure you scanned the correct QR code.');
        } else {
          setError(error.message);
        }
      }
    }
  };

  // Updated JSX - QR SCANNER ONLY (component to be added in TICKET-005)
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-2">Join Event</h1>
          <p className="text-slate-400 mb-8">
            Scan the QR code displayed on the screen to join the event
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">{error}</p>
              <p className="text-red-300 text-xs mt-2">
                Try scanning the QR code again or ask the presenter for a new code
              </p>
            </div>
          )}

          {/* QRScanner component will be inserted here in TICKET-005 */}
          <div className="bg-slate-900 rounded-lg p-6 mb-6 border border-slate-600 border-dashed">
            <p className="text-slate-500 text-center py-8">
              QR Scanner loading...
            </p>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4">
            <p className="text-slate-400 text-xs text-center">
              💡 Enable camera access when prompted to scan the QR code
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**What was removed:**
- ✅ Text input for manual code entry (`<input type="text" />`)
- ✅ Manual "Join" button
- ✅ Copy/paste functionality
- ✅ Form submit handler for manual entry

**What remains:**
- ✅ URL parameter support (for backwards compatibility)
- ✅ Error message display
- ✅ Loading states
- ✅ Navigation to event after join

## Acceptance Criteria

- [ ] Manual text input removed from UI
- [ ] Manual "Join" button removed
- [ ] QR-only message displayed clearly
- [ ] URL parameter support still works (for testing)
- [ ] Error handling for invalid codes preserved
- [ ] Camera permission instructions shown
- [ ] Mobile-responsive layout maintained
- [ ] Accessible design (labels, ARIA attributes)
- [ ] No TypeScript errors

## Testing

**Manual testing:**
1. Navigate to `/join` - should see QR scanner UI only
2. Try `/join?code=ABC123` - should auto-join (for backwards compat)
3. Test error message when code invalid
4. Test on mobile device - full-screen camera view

## Visual Design Notes

The UI should:
- Emphasize camera icon
- Show "Scan QR Code" as primary action
- Display helper text: "Enable camera access when prompted"
- Show error clearly if QR scanning fails
- Be mobile-first (large touch targets)

## Dependencies

- None (can be done independently)

## Related Tickets

- TICKET-005: Add QR scanner component (depends on this ticket's UI layout)
- TICKET-009: Camera permission handling (will improve error UX)

## Notes

- Keep URL parameter support during transition period for development/testing
- Can remove after TICKET-005 is complete and tested
- Update any documentation linking to `/join?code=ABC123` style URLs
