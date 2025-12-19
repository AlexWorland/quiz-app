# TICKET-005: Enforce QR-Only Entry - Add QR Scanner Component

**Priority:** 🔴 CRITICAL
**Effort:** 2-2.5 hours
**Status:** Pending
**Depends On:** TICKET-004

---

## Description

Implement QR code scanner component with camera access handling. This is the primary mechanism for joining events.

## Installation

```bash
cd frontend
npm install html5-qrcode
```

## Files to Create/Modify

### 1. `frontend/src/components/QRScanner.tsx` (NEW FILE)

```typescript
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (code: string) => void;
  isLoading?: boolean;
}

export function QRScanner({ onScan, isLoading = false }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initializeScanner = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // Check camera availability
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          setError('No camera found on this device');
          setIsInitializing(false);
          return;
        }

        // Initialize scanner
        const scanner = new Html5Qrcode('qr-scanner-container', {
          formfactor: 'portrait',
        });

        scannerRef.current = scanner;

        // Configuration
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          supportedFormats: [Html5QrcodeSupportedFormats.QR_CODE],
        };

        // Start scanning
        await scanner.start(
          devices[0].id, // Use first (usually back) camera
          config,
          (decodedText) => {
            // Parse QR code - should be a URL like: http://localhost:5173/join?code=ABC123
            try {
              const url = new URL(decodedText);
              const code = url.searchParams.get('code');

              if (code && code.match(/^[A-Z0-9]{6}$/)) {
                setIsCameraActive(false);
                scanner.stop();
                onScan(code);
              } else {
                setError('Invalid QR code format. Please scan the event QR code.');
              }
            } catch {
              setError('Invalid QR code. Please scan the event QR code.');
            }
          },
          () => {
            // On error
          }
        );

        setIsCameraActive(true);
        setIsInitializing(false);
      } catch (err) {
        let errorMessage = 'Failed to initialize camera';

        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            errorMessage =
              'Camera access denied. Please enable camera permissions in your browser settings and refresh.';
          } else if (err.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device';
          } else if (err.name === 'NotReadableError') {
            errorMessage = 'Camera is being used by another application';
          }
        }

        setError(errorMessage);
        setIsInitializing(false);
      }
    };

    initializeScanner();

    // Cleanup
    return () => {
      if (scannerRef.current && isCameraActive) {
        scannerRef.current
          .stop()
          .catch(() => {
            /* ignore cleanup errors */
          });
      }
    };
  }, [onScan]);

  const handleRetry = async () => {
    try {
      if (scannerRef.current) {
        setError(null);
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          await scannerRef.current.start(devices[0].id, {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          });
          setIsCameraActive(true);
        }
      }
    } catch (err) {
      setError('Failed to restart camera');
    }
  };

  const handleEnableCamera = async () => {
    try {
      setError(null);
      setIsInitializing(true);

      // Request permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());

      // If we get here, permission was granted. Reinitialize
      window.location.reload();
    } catch (err) {
      setError(
        'Please enable camera access in your browser settings. Go to Settings > Privacy > Camera and allow access to this website.'
      );
      setIsInitializing(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Scanner Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden mb-4 aspect-square border-4 border-slate-600"
      >
        <div id="qr-scanner-container" className="w-full h-full" />

        {isInitializing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
              </div>
              <p className="text-white text-sm mt-4">Initializing camera...</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent" />
              <p className="text-white text-sm mt-4">Joining event...</p>
            </div>
          </div>
        )}

        {/* Corner markers for scanning area */}
        <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-cyan-500" />
        <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-cyan-500" />
        <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-cyan-500" />
        <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-cyan-500" />
      </div>

      {/* Instructions */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-4">
        <p className="text-cyan-400 text-sm text-center">
          Position the QR code in the center of the scanner frame
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-sm font-medium mb-3">{error}</p>

          {error.includes('denied') || error.includes('Camera access') ? (
            <button
              onClick={handleEnableCamera}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Open Camera Settings
            </button>
          ) : (
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Fallback Help */}
      {!error && isCameraActive && (
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-slate-400 text-xs text-center">
            Can't scan? Make sure camera access is enabled in browser settings
          </p>
        </div>
      )}
    </div>
  );
}
```

### 2. `frontend/src/pages/JoinEvent.tsx`

Update to use QRScanner component:

```typescript
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QRScanner } from '../components/QRScanner';
import { getOrCreateDeviceFingerprint } from '../utils/deviceFingerprint';
import { joinEvent } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';

export function JoinEvent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const setDeviceInfo = useAuthStore((state) => state.setDeviceInfo);

  // Auto-join if code in URL (backwards compat)
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      handleJoinEvent(codeFromUrl);
    }
  }, [searchParams]);

  const handleJoinEvent = async (code: string) => {
    try {
      setIsLoading(true);
      setError(null);

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
      setIsLoading(false);
    }
  };

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
            </div>
          )}

          <QRScanner onScan={handleJoinEvent} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
```

## Acceptance Criteria

- [ ] `html5-qrcode` library installed
- [ ] QRScanner component created with camera initialization
- [ ] QR code detection working (decodes event code)
- [ ] Camera permission request shown
- [ ] Error handling for:
  - [ ] Camera not found
  - [ ] Camera permission denied
  - [ ] Camera in use by another app
  - [ ] Invalid QR code format
- [ ] Loading state during join
- [ ] Corner markers displayed for scanning guidance
- [ ] Mobile-responsive design
- [ ] Cleanup on unmount
- [ ] No TypeScript errors
- [ ] Component integrates with JoinEvent page

## Testing

**Manual testing:**
1. Generate QR code locally: `qrcode-terminal "http://localhost:5173/join?code=ABC123"`
2. Open `/join` in browser
3. Test successful scan
4. Test invalid QR code (should show error)
5. Revoke camera permission in browser settings
6. Refresh page - should show permission error with recovery option
7. Test on mobile device (iOS/Android)

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (iOS 14.7+)
- Mobile Safari: Full support

## Performance Notes

- FPS set to 10 (lower = less CPU usage)
- QR box size: 250x250px (customizable)
- Supports only QR_CODE format (not other barcode types)

## Dependencies

- TICKET-004: Must be done first (UI layout)

## Related Tickets

- TICKET-004: UI layout
- TICKET-009: Improved camera permission handling

## Notes

- If camera not available, error message guides user clearly
- Component automatically stops/starts camera based on visibility
- Multiple QR code formats supported via `supportedFormats`
- Can extend to support other formats (barcodes, etc.) in future
