import { useState } from 'react'
import { Camera, Check, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '../common/Button'

type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown'

interface CameraPermissionGuideProps {
  onRetry: () => void
  onClose?: () => void
}

export function CameraPermissionGuide({ onRetry, onClose }: CameraPermissionGuideProps) {
  const [testingCamera, setTestingCamera] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null)

  const detectBrowser = (): BrowserType => {
    const ua = navigator.userAgent
    if (ua.includes('Chrome') && !ua.includes('Chromium')) return 'chrome'
    if (ua.includes('Firefox')) return 'firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari'
    if (ua.includes('Edg')) return 'edge'
    return 'unknown'
  }

  const browser = detectBrowser()

  const testCameraAccess = async () => {
    setTestingCamera(true)
    setTestResult(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // Success - stop the stream immediately
      stream.getTracks().forEach((track) => track.stop())
      setTestResult('success')
    } catch (err) {
      setTestResult('failure')
      console.error('Camera test failed:', err)
    } finally {
      setTestingCamera(false)
    }
  }

  const getBrowserInstructions = () => {
    switch (browser) {
      case 'chrome':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Chrome Instructions:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Look for the camera icon or lock icon in the address bar (top left)</li>
              <li>Click on it to open the site permissions menu</li>
              <li>Find "Camera" in the permissions list</li>
              <li>Change it from "Block" to "Allow" or "Ask"</li>
              <li>Click the "Test Camera" button below to verify</li>
            </ol>
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded p-3 mt-3">
              <p className="text-xs text-cyan-300">
                💡 Tip: You may need to refresh the page after changing permissions
              </p>
            </div>
          </div>
        )

      case 'firefox':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Firefox Instructions:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Look for the info icon (ℹ) or camera icon in the address bar</li>
              <li>Click on it and then click "More Information"</li>
              <li>Go to the "Permissions" tab</li>
              <li>Find "Use the Camera" and uncheck "Use Default"</li>
              <li>Select "Allow" from the dropdown</li>
              <li>Close the dialog and click "Test Camera" below</li>
            </ol>
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded p-3 mt-3">
              <p className="text-xs text-cyan-300">
                💡 Tip: Firefox may ask for permission again when you retry
              </p>
            </div>
          </div>
        )

      case 'safari':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Safari Instructions:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Open Safari menu → Settings (or Preferences)</li>
              <li>Click the "Websites" tab at the top</li>
              <li>Find "Camera" in the left sidebar</li>
              <li>Locate this website in the list on the right</li>
              <li>Change the dropdown to "Allow"</li>
              <li>Close Settings and click "Test Camera" below</li>
            </ol>
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded p-3 mt-3">
              <p className="text-xs text-cyan-300">
                💡 Tip: On iOS, also check Settings → Safari → Camera
              </p>
            </div>
          </div>
        )

      case 'edge':
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">Edge Instructions:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Look for the lock icon or camera icon in the address bar</li>
              <li>Click on it to open site permissions</li>
              <li>Find "Camera" in the list</li>
              <li>Change from "Block" to "Allow" or "Ask"</li>
              <li>Click "Test Camera" below to verify access</li>
            </ol>
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded p-3 mt-3">
              <p className="text-xs text-cyan-300">
                💡 Tip: You may need to reload the page after changing permissions
              </p>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white">General Instructions:</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>Look for a lock, info, or camera icon in your browser's address bar</li>
              <li>Click it to open site permissions or settings</li>
              <li>Find camera or media permissions</li>
              <li>Change the setting to "Allow" or "Ask"</li>
              <li>Refresh the page if needed</li>
              <li>Click "Test Camera" below to verify</li>
            </ol>
          </div>
        )
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Camera className="w-8 h-8 text-orange-400" />
          <div>
            <h3 className="text-xl font-bold text-white">Camera Permission Required</h3>
            <p className="text-sm text-slate-400">
              Follow these steps to enable camera access for QR scanning
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
            aria-label="Close guide"
          >
            <XCircle className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Browser-specific instructions */}
      <div className="mb-6">{getBrowserInstructions()}</div>

      {/* Test Camera Section */}
      <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white">Test Camera Access</h4>
          {testResult && (
            <div className="flex items-center gap-2">
              {testResult === 'success' ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Camera working!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Still blocked</span>
                </>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Click the button below to verify that camera permissions are working correctly.
        </p>
        <Button
          onClick={testCameraAccess}
          disabled={testingCamera}
          variant="secondary"
          className="w-full"
        >
          {testingCamera ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing Camera...
            </>
          ) : (
            <>
              <Camera className="w-4 h-4 mr-2" />
              Test Camera
            </>
          )}
        </Button>
      </div>

      {/* Success state - show retry button */}
      {testResult === 'success' && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-green-300 font-semibold mb-1">
                Camera access granted!
              </p>
              <p className="text-xs text-green-300/80">
                You can now try scanning the QR code again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onClose && (
          <Button onClick={onClose} variant="secondary" className="flex-1">
            Cancel
          </Button>
        )}
        <Button
          onClick={onRetry}
          disabled={testResult !== 'success'}
          className="flex-1"
        >
          {testResult === 'success' ? 'Try Scanning Again' : 'Complete Steps First'}
        </Button>
      </div>

      {/* Additional Help */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-400 hover:text-white transition">
            Still having trouble?
          </summary>
          <div className="mt-3 space-y-2 text-xs text-slate-400">
            <p>• Make sure no other application is using your camera</p>
            <p>• Check that no other browser tab has camera access</p>
            <p>• Try closing and reopening your browser</p>
            <p>• On mobile, check system camera permissions in Settings</p>
            <p>• As a last resort, try a different browser or device</p>
          </div>
        </details>
      </div>
    </div>
  )
}

