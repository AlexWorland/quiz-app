import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { Camera, XCircle, AlertCircle, Smartphone } from 'lucide-react'
import { Button } from '../common/Button'
import { CameraPermissionGuide } from './CameraPermissionGuide'

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onError?: (error: string) => void
  onClose?: () => void
  onManualEntry?: () => void
}

type ScannerState = 'idle' | 'requesting_permission' | 'scanning' | 'error' | 'no_camera' | 'permission_denied'
type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown'

export function QRScanner({ onScan, onError, onClose, onManualEntry }: QRScannerProps) {
  const [state, setState] = useState<ScannerState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [browser, setBrowser] = useState<BrowserType>('unknown')
  const [showPermissionGuide, setShowPermissionGuide] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerId = 'qr-scanner-region'

  // Detect browser type
  const detectBrowser = (): BrowserType => {
    const ua = navigator.userAgent
    if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'chrome'
    if (ua.includes('Firefox')) return 'firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari'
    if (ua.includes('Edg')) return 'edge'
    return 'unknown'
  }

  // Check permission status for camera
  const checkCameraPermission = async (): Promise<PermissionStatus | null> => {
    try {
      if (!navigator.permissions?.query) return null
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
      return result
    } catch {
      return null
    }
  }

  const createScannerInstance = () => {
    const instance = new Html5Qrcode(scannerId)

    // In tests, the html5-qrcode mock overrides prototype methods,
    // so copy any prototype overrides onto the instance to ensure they apply.
    if (Html5Qrcode.prototype.start) {
      instance.start = Html5Qrcode.prototype.start.bind(instance)
    }
    if (Html5Qrcode.prototype.stop) {
      instance.stop = Html5Qrcode.prototype.stop.bind(instance)
    }
    if (Html5Qrcode.prototype.clear) {
      instance.clear = Html5Qrcode.prototype.clear.bind(instance)
    }
    if (Html5Qrcode.prototype.getState) {
      instance.getState = Html5Qrcode.prototype.getState.bind(instance)
    }

    return instance
  }

  useEffect(() => {
    // Detect browser on mount
    setBrowser(detectBrowser())
  }, [])

  useEffect(() => {
    // Initialize scanner when component mounts
    const initScanner = async () => {
      if (!containerRef.current) return

      setState('requesting_permission')
      setErrorMessage(null)

      try {
        // Check permission status
        const permStatus = await checkCameraPermission()
        if (permStatus?.state === 'denied') {
          setState('permission_denied')
          setErrorMessage('Camera permission was denied')
          onError?.('Camera permission denied')
          return
        }

        // Check if camera is available
        const devices = await Html5Qrcode.getCameras()
        if (!devices || devices.length === 0) {
          setState('no_camera')
          setErrorMessage('No camera found on this device')
          onError?.('No camera found on this device')
          return
        }

        // Create scanner instance
        const scanner = createScannerInstance()
        scannerRef.current = scanner

        // Start scanning with back camera preferred
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            // Successfully scanned
            onScan(decodedText)
            stopScanner()
          },
          () => {
            // Scan error (happens continuously while scanning)
            // We don't report these as they're normal
          }
        )

        setState('scanning')
      } catch (err) {
        console.error('QR Scanner error:', err)

        let message = 'Failed to start camera'
        let errorState: ScannerState = 'error'

        if (err instanceof Error) {
          if (err.message.includes('Permission') || err.message.includes('NotAllowedError')) {
            message = 'Camera permission was denied by the browser'
            errorState = 'permission_denied'
          } else if (err.message.includes('NotFoundError')) {
            message = 'No camera found on this device'
            errorState = 'no_camera'
          } else if (err.message.includes('NotReadableError')) {
            message = 'Camera is already in use by another application'
          } else if (err.message.includes('OverconstrainedError')) {
            message = 'Camera does not support the required constraints'
          }
        }

        setState(errorState)
        setErrorMessage(message)
        onError?.(message)
      }
    }

    initScanner()

    // Cleanup on unmount
    return () => {
      stopScanner()
    }
  }, [])

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const currentState = scannerRef.current.getState()
        if (currentState === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
      scannerRef.current = null
    }
  }

  const handleRetry = async () => {
    setState('idle')
    setErrorMessage(null)

    // Re-initialize scanner
    const initScanner = async () => {
      if (!containerRef.current) return

      setState('requesting_permission')

      try {
        const devices = await Html5Qrcode.getCameras()
        if (!devices || devices.length === 0) {
          setState('no_camera')
          setErrorMessage('No camera found on this device')
          return
        }

        const scanner = createScannerInstance()
        scannerRef.current = scanner

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        }

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            onScan(decodedText)
            stopScanner()
          },
          () => {}
        )

        setState('scanning')
      } catch (err) {
        setState('error')
        setErrorMessage('Failed to start camera. Please check your permissions.')
        onError?.('Failed to start camera')
      }
    }

    await initScanner()
  }

  // Show permission guide if requested
  if (showPermissionGuide) {
    return (
      <CameraPermissionGuide
        onRetry={() => {
          setShowPermissionGuide(false)
          handleRetry()
        }}
        onClose={() => {
          setShowPermissionGuide(false)
          onClose?.()
        }}
      />
    )
  }

  return (
    <div ref={containerRef} className="w-full max-w-md mx-auto">
      {/* Close button */}
      {onClose && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close scanner"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Scanner states */}
      {state === 'requesting_permission' && (
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <Camera className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-semibold text-white mb-2">
            Requesting Camera Access
          </h3>
          <p className="text-slate-400">
            Please allow camera access in your browser to scan the QR code
          </p>
        </div>
      )}

      {state === 'scanning' && (
        <div className="space-y-4">
          {/* Scanner viewport */}
          <div id={scannerId} className="rounded-lg overflow-hidden border-2 border-cyan-500" />

          {/* Instructions */}
          <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
            <p className="text-cyan-100 text-sm text-center">
              <Camera className="w-4 h-4 inline mr-2" />
              Point your camera at the QR code displayed on the presenter's screen
            </p>
          </div>
        </div>
      )}

      {(state === 'error' || state === 'no_camera' || state === 'permission_denied') && (
        <div className={`${state === 'permission_denied' ? 'bg-orange-900/20 border border-orange-600/30' : 'bg-red-900/20 border border-red-500/30'} rounded-lg p-6`}>
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className={`w-6 h-6 ${state === 'permission_denied' ? 'text-orange-400' : 'text-red-400'} flex-shrink-0 mt-1`} />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {state === 'no_camera' && 'No Camera Available'}
                {state === 'permission_denied' && 'Camera Permission Needed'}
                {state === 'error' && 'Camera Access Error'}
              </h3>
              <p className={`text-sm ${state === 'permission_denied' ? 'text-orange-300' : 'text-red-300'}`}>{errorMessage}</p>
            </div>
          </div>

          {/* Help text - specific to state */}
          <div className="bg-slate-900/50 rounded p-3 mb-4">
            <p className="text-slate-300 text-xs mb-2 font-semibold">
              How to fix this:
            </p>
            <ul className="text-slate-400 text-xs space-y-1 list-disc list-inside">
              {state === 'no_camera' && (
                <>
                  <li>Make sure your device has a camera</li>
                  <li>Try using a different device with a camera</li>
                  <li>Use manual code entry as an alternative</li>
                </>
              )}

              {state === 'permission_denied' && (
                <>
                  <li>Click "Allow" when your browser asks for camera access</li>
                  {browser === 'chrome' && (
                    <>
                      <li>Click the lock icon in the address bar</li>
                      <li>Find "Camera" in the permissions list</li>
                      <li>Change it from "Block" to "Allow"</li>
                      <li>Refresh the page to try again</li>
                    </>
                  )}
                  {browser === 'firefox' && (
                    <>
                      <li>Click the info icon (ℹ) in the address bar</li>
                      <li>Click the arrow next to "Camera"</li>
                      <li>Select "Always Allow" or "Allow"</li>
                      <li>Refresh the page to try again</li>
                    </>
                  )}
                  {browser === 'safari' && (
                    <>
                      <li>Go to Safari menu → Settings</li>
                      <li>Click the "Websites" tab</li>
                      <li>Find "Camera" in the left sidebar</li>
                      <li>Set this site to "Allow"</li>
                      <li>Refresh the page to try again</li>
                    </>
                  )}
                  {browser === 'edge' && (
                    <>
                      <li>Click the lock icon in the address bar</li>
                      <li>Find "Camera" permissions</li>
                      <li>Change from "Block" to "Allow"</li>
                      <li>Refresh the page to try again</li>
                    </>
                  )}
                  {browser === 'unknown' && (
                    <>
                      <li>Look for permission settings in your browser's address bar</li>
                      <li>Find and allow "Camera" access for this site</li>
                      <li>Refresh the page to try again</li>
                    </>
                  )}
                </>
              )}

              {state === 'error' && (
                <>
                  <li>Close any other apps using your camera</li>
                  <li>Check that no other browser tab is using the camera</li>
                  <li>Make sure camera permissions are allowed in settings</li>
                  <li>Try refreshing the page</li>
                </>
              )}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            {state === 'permission_denied' && (
              <Button
                onClick={() => setShowPermissionGuide(true)}
                className="w-full"
              >
                Show Detailed Instructions
              </Button>
            )}
            
            {(state === 'error' || state === 'permission_denied') && (
              <Button
                onClick={handleRetry}
                variant="secondary"
                className="w-full"
              >
                Try Again
              </Button>
            )}

            {onManualEntry && (
              <Button
                onClick={onManualEntry}
                variant="secondary"
                className="w-full"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                Enter Code Manually
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
