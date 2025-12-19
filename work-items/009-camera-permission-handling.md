# TICKET-009: Implement Camera Permission Handling in QR Scanner

**Priority:** 🟡 HIGH
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-005

---

## Description

Enhance QRScanner component with robust camera permission handling, browser-specific instructions, and recovery options.

## Files to Modify

### 1. `frontend/src/components/QRScanner.tsx`

Update error handling section with browser detection:

```typescript
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (code: string) => void;
  isLoading?: boolean;
}

// Browser detection utility
function getBrowserType(): 'chrome' | 'firefox' | 'safari' | 'edge' | 'other' {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
  if (ua.includes('Edg')) return 'edge';
  if (ua.includes('Chrome')) return 'chrome';
  return 'other';
}

// Browser-specific instructions
function getCameraInstructions(browser: string): string {
  switch (browser) {
    case 'chrome':
    case 'edge':
      return 'Go to Settings > Privacy > Camera > Allowed to add this site';
    case 'firefox':
      return 'Go to Settings > Privacy > Permissions > Camera > Allow for this site';
    case 'safari':
      return 'Go to Settings > Websites > Camera and select "Allow"';
    default:
      return 'Enable camera permissions in your browser settings';
  }
}

export function QRScanner({ onScan, isLoading = false }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initializeScanner = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        setPermissionDenied(false);

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
          devices[0].id,
          config,
          (decodedText) => {
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
        let isDenied = false;

        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            isDenied = true;
            setPermissionDenied(true);
            const browser = getBrowserType();
            const instructions = getCameraInstructions(browser);
            errorMessage = `Camera access denied. ${instructions}`;
          } else if (err.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device';
          } else if (err.name === 'NotReadableError') {
            errorMessage =
              'Camera is being used by another application. Please close other apps and try again.';
          } else if (err.name === 'SecurityError') {
            errorMessage = 'Camera access requires HTTPS. Please use a secure connection.';
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
      const browser = getBrowserType();
      const instructions = getCameraInstructions(browser);
      setError(
        `Please enable camera access in your browser settings.\n\n${instructions}\n\nThen refresh this page.`
      );
      setIsInitializing(false);
    }
  };

  const handleOpenSettings = () => {
    const browser = getBrowserType();
    let url = '';

    switch (browser) {
      case 'chrome':
      case 'edge':
        url = 'chrome://settings/content/camera';
        break;
      case 'firefox':
        url = 'about:preferences#privacy';
        break;
      case 'safari':
        // Safari doesn't have a direct URL, show instructions
        alert(
          'Go to System Preferences > Security & Privacy > Camera and enable access'
        );
        return;
      default:
        alert('Please enable camera permissions in your browser settings');
        return;
    }

    if (url) {
      window.open(url, '_blank');
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

        {/* Corner markers */}
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

      {/* Error State - Permission Denied */}
      {error && permissionDenied && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-sm font-medium mb-3 whitespace-pre-line">
            {error}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleOpenSettings}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Open Settings
            </button>
            <button
              onClick={handleEnableCamera}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Error State - Other */}
      {error && !permissionDenied && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
          <p className="text-red-300 text-sm font-medium mb-3">{error}</p>
          <button
            onClick={handleRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Help Text */}
      {!error && isCameraActive && (
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-slate-400 text-xs text-center">
            💡 Make sure camera access is enabled in browser settings
          </p>
        </div>
      )}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Browser detection utility created
- [ ] Browser-specific camera permission instructions displayed
- [ ] DOMException names properly handled (NotAllowedError, NotFoundError, NotReadableError, SecurityError)
- [ ] Camera in-use error message shown
- [ ] HTTPS requirement error shown
- [ ] "Open Settings" button works for Chrome/Edge/Firefox
- [ ] "Retry" button attempts to restart camera
- [ ] Clear visual distinction between permission denied and other errors
- [ ] Mobile-friendly error messages
- [ ] No TypeScript errors
- [ ] Tested on Chrome, Firefox, Safari, Edge

## Testing Scenarios

1. **Permission Denied:**
   - Click "Don't allow" on camera permission prompt
   - Verify error message with browser-specific instructions
   - Click "Open Settings" - should open browser settings
   - Click "Retry" - should re-request permission

2. **Camera In Use:**
   - Start camera in another tab
   - Should show "Camera is being used by another application"
   - Click "Try Again" after closing other app

3. **No Camera:**
   - Run on device without camera
   - Should show "No camera found on this device"

4. **HTTPS Requirement:**
   - Test on HTTP connection
   - Should show "Camera access requires HTTPS"

## Dependencies

- TICKET-005: QRScanner component must exist first

## Related Tickets

- TICKET-005: QR scanner component
- TICKET-004: Enforce QR-only entry

## Notes

- Consider adding a privacy notice about camera access
- Could add analytics to track permission denial rates
- Consider fallback UI for users who deny camera access (manual entry with PIN?)
