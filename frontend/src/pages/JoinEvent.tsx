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
      setDeviceInfo(response.data.deviceId, response.data.sessionToken);
      navigate(`/events/${response.data.eventId}`);
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


