import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { joinEvent, getEventByJoinCode, recoverParticipant } from '../api/endpoints';
import { 
  setCurrentEventSession, 
  getCurrentEventSession, 
  clearCurrentEventSession, 
  validateEventJoin, 
  getEventConflictInfo 
} from '../utils/deviceSession';
import { useAuthStore } from '../store/authStore';
import { AvatarSelector } from '../components/auth/AvatarSelector';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { QRScanner } from '../components/event/QRScanner';
import { RecoverSession } from '../components/event/RecoverSession';
import { WebRTCUnsupportedNotice } from '../components/event/WebRTCUnsupportedNotice';
import { detectWebRTCSupport, WebRTCUnsupportedReason } from '../utils/webrtcDetection';

type JoinStep = 'scan_qr' | 'enter_code' | 'enter_details' | 'joining';

export function JoinEvent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<JoinStep>(searchParams.get('code') ? 'enter_details' : 'scan_qr');
  const [eventCode, setEventCode] = useState(searchParams.get('code') || '');
  const [eventTitle, setEventTitle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('😀');
  const [avatarType, setAvatarType] = useState<'emoji' | 'preset' | 'custom'>('emoji');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [webrtcSupported, setWebrtcSupported] = useState(true);
  const [webrtcUnsupportedReason, setWebrtcUnsupportedReason] = useState<WebRTCUnsupportedReason>();
  const setDeviceInfo = useAuthStore((state) => state.setDeviceInfo);
  const [deviceConflict, setDeviceConflict] = useState<{
    currentEvent: { id: string; title: string; joinedAt: Date }
    targetEvent: { code: string; title: string }
  } | null>(null);

  // Detect WebRTC support on mount and when step changes to 'scan_qr'
  useEffect(() => {
    if (step === 'scan_qr') {
      const result = detectWebRTCSupport();
      setWebrtcSupported(result.isSupported);
      if (!result.isSupported) {
        setWebrtcUnsupportedReason(result.reason);
      }
    }
  }, [step]);

  // Handle manual code entry
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventCode.trim()) {
      setError('Please enter an event code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verify the event exists before showing the form
      const response = await getEventByJoinCode(eventCode.toUpperCase());
      setEventTitle(response.data.title);
      setEventCode(eventCode.toUpperCase());
      setStep('enter_details');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('not found') || err.message.includes('404')) {
          setError('Event not found. Please check the code and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to find event');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle join submission
  const handleJoinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    // Validate device session before proceeding  
    const validation = validateEventJoin(eventCode)
    if (!validation.allowed && validation.conflict) {
      setDeviceConflict({
        currentEvent: validation.conflict,
        targetEvent: { code: eventCode, title: eventTitle }
      })
      setError(null)
      return
    }

    setStep('joining');
    setError(null);

    try {
      const deviceFingerprint = getOrCreateDeviceFingerprint();
      const response = await joinEvent({
        code: eventCode,
        deviceFingerprint,
        display_name: displayName.trim(),
        avatar_url: avatarUrl,
        avatar_type: avatarType,
      });

      setDeviceInfo(response.data.deviceId, response.data.sessionToken);

      // Track current event session
      setCurrentEventSession(response.data.eventId, eventTitle, response.data.sessionToken);

      // Navigate to the event
      navigate(`/events/${response.data.eventId}`);
    } catch (err: any) {
      setStep('enter_details');
      const status = err?.response?.status;
      const data = err?.response?.data;
      const errorMessage = data?.detail || err?.message || 'Failed to join event';

      if (status === 409 && data?.is_rejoining) {
        setDeviceInfo(data.event_id, data.session_token);
        // Update session tracking for rejoin
        setCurrentEventSession(data.event_id, eventTitle || 'Event', data.session_token);
        navigate(`/events/${data.event_id}`);
        return;
      }

      if (errorMessage.includes('already joined')) {
        setError('This device has already joined this event. You will be reconnected.');
      } else if (errorMessage.includes('already in another active event')) {
        // 409 Conflict - device in different event
        const conflictInfo = getEventConflictInfo()
        if (conflictInfo) {
          setDeviceConflict({
            currentEvent: conflictInfo,
            targetEvent: { code: eventCode, title: eventTitle }
          })
          setError(null) // Clear error since we're showing conflict UI
        } else {
          setError('This device is already participating in another active event. Please finish that event first or use a different device.')
        }
      } else if (errorMessage.includes('not found')) {
        setError('Event not found. Please check the code and try again.');
      } else if (errorMessage.includes('ended')) {
        setError('This event has already ended.');
      } else if (errorMessage.includes('locked')) {
        setError('This event is not accepting new participants at this time.');
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleAvatarSelect = (url: string, type: 'emoji' | 'preset' | 'custom') => {
    setAvatarUrl(url);
    setAvatarType(type);
  };

  // Handle session recovery
  const handleRecover = async (displayName: string) => {
    const newFingerprint = crypto.randomUUID();
    const response = await recoverParticipant(eventCode, {
      display_name: displayName,
      new_device_fingerprint: newFingerprint,
    });

    // Store new device info
    setDeviceInfo(response.data.deviceId, response.data.sessionToken);
    localStorage.setItem('device_fingerprint', response.data.deviceId);

    // Navigate to event
    navigate(`/events/${response.data.eventId}`);
  };

  // Handle QR code scan
  const handleQRScan = async (scannedText: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Extract code from URL or use directly
      let code = scannedText;
      const urlMatch = scannedText.match(/[?&]code=([A-Z0-9]{6})/i);
      if (urlMatch) {
        code = urlMatch[1];
      } else if (scannedText.includes('/join/')) {
        const parts = scannedText.split('/join/');
        code = parts[1]?.split(/[?&#]/)[0] || scannedText;
      }

      code = code.toUpperCase().trim();

      if (code.length !== 6) {
        setError('Invalid QR code. Please scan the event QR code or enter manually.');
        setStep('enter_code');
        return;
      }

      // Verify event exists
      const response = await getEventByJoinCode(code);
      setEventTitle(response.data.title);
      setEventCode(code);
      setStep('enter_details');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('not found') || err.message.includes('404')) {
          setError('Event not found or has expired. The QR code may be invalid.');
        } else if (err.message.includes('403') || err.message.includes('locked')) {
          setError('This event is not accepting new participants at this time.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to scan QR code');
      }
      setStep('enter_code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-xl shadow-2xl p-8 border border-slate-700">

          {/* Step 1: Scan QR Code */}
          {step === 'scan_qr' && (
            <>
              <h1 className="text-3xl font-bold text-white mb-2">Join Event</h1>
              <p className="text-slate-400 mb-6">
                Scan the QR code shown on the presenter's screen
              </p>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              {deviceConflict && (
                <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="text-orange-400 text-xl">⚠️</div>
                    <div className="flex-1">
                      <h3 className="text-orange-300 font-semibold mb-2">Device Already in Another Event</h3>
                      <p className="text-orange-200/90 text-sm mb-3">
                        This device is currently participating in "{deviceConflict.currentEvent.title}".
                        You can only participate in one event at a time.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={async () => {
                            clearCurrentEventSession()
                            setDeviceConflict(null)
                            // Try joining the new event
                            await handleJoinSubmit()
                          }}
                          variant="primary"
                          className="flex-1 text-sm"
                        >
                          Leave Current Event & Join This One
                        </Button>
                        <Button
                          onClick={() => {
                            setDeviceConflict(null)
                            navigate(`/events/${deviceConflict.currentEvent.id}`)
                          }}
                          variant="secondary"
                          className="flex-1 text-sm"
                        >
                          Return to Current Event
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!webrtcSupported && (
                <WebRTCUnsupportedNotice
                  reason={webrtcUnsupportedReason}
                  onUseManualEntry={() => setStep('enter_code')}
                />
              )}

              {webrtcSupported && (
                <>
                  <QRScanner
                    onScan={handleQRScan}
                    onError={(err) => setError(err)}
                  />

                  <div className="mt-6">
                    <button
                      onClick={() => setStep('enter_code')}
                      className="w-full text-slate-400 hover:text-white text-sm py-2 transition"
                    >
                      Can't scan? Enter code manually →
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* Step 2: Enter Code Manually */}
          {step === 'enter_code' && (
            <>
              <button
                onClick={() => setStep('scan_qr')}
                className="text-slate-400 hover:text-white mb-4 text-sm flex items-center gap-1"
              >
                ← Back to QR scan
              </button>

              <h1 className="text-3xl font-bold text-white mb-2">Join Event</h1>
              <p className="text-slate-400 mb-8">
                Enter the event code manually
              </p>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleCodeSubmit}>
                <Input
                  type="text"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  className="text-center text-2xl tracking-widest font-mono uppercase mb-6"
                  maxLength={6}
                  autoFocus
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || eventCode.length < 6}
                >
                  {isLoading ? 'Finding event...' : 'Continue'}
                </Button>
              </form>

              <div className="mt-6 bg-slate-700/30 rounded-lg p-4">
                <p className="text-slate-400 text-xs text-center">
                  💡 The event code is displayed on the presenter's screen
                </p>
              </div>
            </>
          )}

          {/* Step 2: Enter Details */}
          {step === 'enter_details' && (
            <>
              <button
                onClick={() => setStep('enter_code')}
                className="text-slate-400 hover:text-white mb-4 text-sm flex items-center gap-1"
              >
                ← Back
              </button>

              <h1 className="text-2xl font-bold text-white mb-1">
                Joining: {eventTitle}
              </h1>
              <p className="text-slate-400 text-sm mb-6">
                Code: {eventCode}
              </p>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleJoinSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Your Display Name *
                  </label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={50}
                    autoFocus
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    This is how you'll appear on the leaderboard
                  </p>
                </div>

                <AvatarSelector onSelect={handleAvatarSelect} />

                <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg">
                  <div className="text-4xl">
                    {avatarType === 'emoji' ? avatarUrl : (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-white font-medium">{displayName || 'Your Name'}</p>
                    <p className="text-slate-400 text-sm">Preview</p>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!displayName.trim()}
                >
                  Join Event
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowRecovery(true)}
                  className="text-sm text-slate-400 hover:text-white transition underline"
                >
                  Lost your session? Recover it here
                </button>
              </div>
            </>
          )}

          {/* Step 3: Joining */}
          {step === 'joining' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-white mb-2">Joining Event...</h2>
              <p className="text-slate-400">Please wait</p>
            </div>
          )}
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecovery && (
        <RecoverSession
          eventCode={eventCode}
          onRecover={handleRecover}
          onClose={() => setShowRecovery(false)}
        />
      )}
    </div>
  );
}
