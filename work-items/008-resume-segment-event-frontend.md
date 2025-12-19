# TICKET-008: Resume Segment/Event - Frontend Modals

**Priority:** 🔴 CRITICAL
**Effort:** 2-2.5 hours
**Status:** Pending
**Depends On:** TICKET-007

---

## Description

Implement modal dialogs to prompt host when resuming accidental segment/event endings. Auto-hide after 30 seconds if no action taken.

## Files to Create

### 1. `frontend/src/components/quiz/ResumeSegmentModal.tsx` (NEW FILE)

```typescript
import { useEffect, useState } from 'react';

interface ResumeSegmentModalProps {
  segmentName: string;
  onResume: () => void;
  onStartFresh: () => void;
  onClose: () => void;
}

export function ResumeSegmentModal({
  segmentName,
  onResume,
  onStartFresh,
  onClose,
}: ResumeSegmentModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-sm w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="bg-yellow-500/20 rounded-full p-3 mr-4">
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Resume Segment?</h2>
          </div>

          {/* Content */}
          <p className="text-slate-300 mb-6">
            The segment "<span className="font-semibold">{segmentName}</span>" was just ended.
            Would you like to resume it or start fresh?
          </p>

          {/* Timer Info */}
          <div className="bg-slate-700/30 rounded-lg p-3 mb-6 border border-slate-600">
            <p className="text-slate-400 text-sm text-center">
              This dialog will close in{' '}
              <span className="font-mono font-bold text-cyan-400">{secondsRemaining}s</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onResume}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Resume Segment
            </button>
            <button
              onClick={onStartFresh}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Start Fresh
            </button>
          </div>

          {/* Close option */}
          <button
            onClick={onClose}
            className="w-full mt-3 text-slate-400 hover:text-slate-300 text-sm py-2 transition-colors"
          >
            Clear Resume State
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 2. `frontend/src/components/quiz/ResumeEventModal.tsx` (NEW FILE)

```typescript
import { useEffect, useState } from 'react';

interface ResumeEventModalProps {
  eventName: string;
  onResume: () => void;
  onStartFresh: () => void;
  onClose: () => void;
}

export function ResumeEventModal({
  eventName,
  onResume,
  onStartFresh,
  onClose,
}: ResumeEventModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-sm w-full">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="bg-yellow-500/20 rounded-full p-3 mr-4">
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Resume Event?</h2>
          </div>

          {/* Content */}
          <p className="text-slate-300 mb-6">
            The event "<span className="font-semibold">{eventName}</span>" was just ended.
            Would you like to resume it or start a new event?
          </p>

          {/* Timer Info */}
          <div className="bg-slate-700/30 rounded-lg p-3 mb-6 border border-slate-600">
            <p className="text-slate-400 text-sm text-center">
              This dialog will close in{' '}
              <span className="font-mono font-bold text-cyan-400">{secondsRemaining}s</span>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onResume}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Resume Event
            </button>
            <button
              onClick={onStartFresh}
              className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Start New Event
            </button>
          </div>

          {/* Close option */}
          <button
            onClick={onClose}
            className="w-full mt-3 text-slate-400 hover:text-slate-300 text-sm py-2 transition-colors"
          >
            Clear Resume State
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3. `frontend/src/pages/EventHost.tsx`

Update to check for resume state and show modals:

```typescript
import { useEffect, useState } from 'react';
import { ResumeSegmentModal } from '../components/quiz/ResumeSegmentModal';
import { ResumeEventModal } from '../components/quiz/ResumeEventModal';
import { useEventWebSocket } from '../hooks/useEventWebSocket';

interface ResumeState {
  type: 'segment' | 'event' | null;
  name: string;
}

export function EventHost() {
  const [resumeState, setResumeState] = useState<ResumeState>({ type: null, name: '' });
  const { send } = useEventWebSocket(eventId);

  // Check for resume state when component mounts or event loads
  useEffect(() => {
    const checkResumeState = async () => {
      try {
        // Fetch event details to check for resume state
        const response = await fetch(`/api/events/${eventId}`);
        const event = await response.json();

        // Check if event has resume state
        if (event.previous_status) {
          setResumeState({
            type: 'event',
            name: event.name,
          });
          return;
        }

        // Check if current segment has resume state
        if (event.current_segment?.previous_status) {
          setResumeState({
            type: 'segment',
            name: event.current_segment?.title || 'Current Segment',
          });
        }
      } catch (error) {
        console.error('Failed to check resume state:', error);
      }
    };

    checkResumeState();
  }, [eventId]);

  // Listen for WebSocket resume messages
  useEffect(() => {
    const handleResumeMessage = (message: any) => {
      if (message.type === 'segment_resumed') {
        // Quiz state restored, clear modal
        setResumeState({ type: null, name: '' });
      } else if (message.type === 'event_resumed') {
        // Event state restored, clear modal
        setResumeState({ type: null, name: '' });
      } else if (message.type === 'resume_not_available') {
        // Show error to user
        console.error('Resume not available:', message.reason);
        setResumeState({ type: null, name: '' });
      }
    };

    // Register listener with WebSocket hook
    // (implementation depends on how your hook handles listeners)
  }, []);

  const handleResumeSegment = () => {
    send({
      type: 'resume_segment',
    });
    setResumeState({ type: null, name: '' });
  };

  const handleResumeEvent = () => {
    send({
      type: 'resume_event',
    });
    setResumeState({ type: null, name: '' });
  };

  const handleStartFresh = () => {
    send({
      type: 'clear_resume_state',
    });
    setResumeState({ type: null, name: '' });
  };

  const handleCloseModal = () => {
    setResumeState({ type: null, name: '' });
  };

  return (
    <div>
      {/* Event host UI */}

      {/* Resume Modals */}
      {resumeState.type === 'segment' && (
        <ResumeSegmentModal
          segmentName={resumeState.name}
          onResume={handleResumeSegment}
          onStartFresh={handleStartFresh}
          onClose={handleCloseModal}
        />
      )}

      {resumeState.type === 'event' && (
        <ResumeEventModal
          eventName={resumeState.name}
          onResume={handleResumeEvent}
          onStartFresh={handleStartFresh}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] `ResumeSegmentModal` component created with 30-second auto-close
- [ ] `ResumeEventModal` component created with 30-second auto-close
- [ ] Modals styled consistently with app design
- [ ] Timer counts down visibly
- [ ] Three action buttons: Resume, Start Fresh, Clear Resume State
- [ ] EventHost checks for resume state on load
- [ ] Modals show for segment endings
- [ ] Modals show for event endings
- [ ] WebSocket messages sent correctly
- [ ] Modal dismisses on successful resume
- [ ] Modal dismisses on timeout
- [ ] No TypeScript errors
- [ ] Accessible (keyboard navigation, screen reader support)

## Testing

```typescript
// Example test
describe('ResumeSegmentModal', () => {
  it('should auto-dismiss after 30 seconds', async () => {
    // Test countdown timer
  });

  it('should call onResume when Resume button clicked', () => {
    // Test resume action
  });

  it('should call onStartFresh when Start Fresh button clicked', () => {
    // Test start fresh action
  });
});
```

## Dependencies

- TICKET-007: Backend handlers

## Related Tickets

- TICKET-007: Backend handlers (must be done first)
- TICKET-017: Join state awareness (may interact with resume state)

## Notes

- 30-second auto-close time is configurable
- Consider adding sound notification when modal appears
- Could add analytics to track how often resume is used
- Consider persistent storage of resume state for page refreshes
