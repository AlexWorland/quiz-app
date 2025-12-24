import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QRScanner } from '../QRScanner'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'

// Mock html5-qrcode
vi.mock('html5-qrcode', () => {
  const mockScanner = {
    start: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
    getState: vi.fn(() => Html5QrcodeScannerState.SCANNING),
  }

  return {
    Html5Qrcode: vi.fn(() => mockScanner),
    Html5QrcodeScannerState: {
      SCANNING: 2,
      PAUSED: 3,
      NOT_STARTED: 1,
    },
  }
})

describe('QRScanner', () => {
  const mockOnScan = vi.fn()
  const mockOnError = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Html5Qrcode.getCameras to return a camera
    Html5Qrcode.getCameras = vi.fn().mockResolvedValue([
      { id: 'camera1', label: 'Back Camera' }
    ])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render requesting permission state initially', async () => {
    render(<QRScanner onScan={mockOnScan} />)

    expect(screen.getByText('Requesting Camera Access')).toBeInTheDocument()
    expect(screen.getByText(/Please allow camera access/i)).toBeInTheDocument()
  })

  it('should initialize scanner and start scanning', async () => {
    const mockStart = vi.fn().mockResolvedValue(undefined)
    Html5Qrcode.prototype.start = mockStart

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(Html5Qrcode.getCameras).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith(
        { facingMode: 'environment' },
        expect.objectContaining({
          fps: 10,
          qrbox: { width: 250, height: 250 },
        }),
        expect.any(Function),
        expect.any(Function)
      )
    })
  })

  it('should call onScan when QR code is successfully scanned', async () => {
    const testUrl = 'https://example.com/join/ABC123'
    let scanSuccessCallback: ((decodedText: string) => void) | null = null

    Html5Qrcode.prototype.start = vi.fn().mockImplementation(
      (cameraId, config, onSuccess) => {
        scanSuccessCallback = onSuccess
        return Promise.resolve()
      }
    )

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    // Simulate successful scan
    if (scanSuccessCallback) {
      scanSuccessCallback(testUrl)
    }

    expect(mockOnScan).toHaveBeenCalledWith(testUrl)
  })

  it('should show error when no camera is found', async () => {
    Html5Qrcode.getCameras = vi.fn().mockResolvedValue([])

    render(<QRScanner onScan={mockOnScan} onError={mockOnError} />)

    await waitFor(() => {
      expect(screen.getByText('No Camera Available')).toBeInTheDocument()
    })

    expect(screen.getByText('No camera found on this device')).toBeInTheDocument()
    expect(mockOnError).toHaveBeenCalledWith('No camera found on this device')
  })

  it('should show error when camera permission is denied', async () => {
    const permissionError = new Error('Permission denied')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permissionError)

    render(<QRScanner onScan={mockOnScan} onError={mockOnError} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Camera permission was denied by the browser/i)).toBeInTheDocument()
    expect(mockOnError).toHaveBeenCalled()
  })

  it('should show error when camera is in use', async () => {
    const inUseError = new Error('NotReadableError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(inUseError)

    render(<QRScanner onScan={mockOnScan} onError={mockOnError} />)

    await waitFor(() => {
      expect(screen.getByText(/Camera is already in use/i)).toBeInTheDocument()
    })
  })

  it('should render close button when onClose is provided', () => {
    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />)

    const closeButton = screen.getByLabelText('Close scanner')
    expect(closeButton).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup()

    render(<QRScanner onScan={mockOnScan} onClose={mockOnClose} />)

    const closeButton = screen.getByLabelText('Close scanner')
    await user.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show retry button on error', async () => {
    const scanError = new Error('Camera error')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(scanError)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Access Error')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('should not show retry button when no camera is found', async () => {
    Html5Qrcode.getCameras = vi.fn().mockResolvedValue([])

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('No Camera Available')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('should retry scanning when retry button is clicked', async () => {
    const user = userEvent.setup()
    const scanError = new Error('Camera error')

    let callCount = 0
    Html5Qrcode.prototype.start = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(scanError)
      }
      return Promise.resolve()
    })

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Access Error')).toBeInTheDocument()
    })

    const retryButton = screen.getByRole('button', { name: /try again/i })
    await user.click(retryButton)

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalledTimes(2)
    })
  })

  it('should clean up scanner on unmount', async () => {
    const mockStop = vi.fn().mockResolvedValue(undefined)
    const mockClear = vi.fn()

    Html5Qrcode.prototype.stop = mockStop
    Html5Qrcode.prototype.clear = mockClear

    const { unmount } = render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    unmount()

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalled()
      expect(mockClear).toHaveBeenCalled()
    })
  })

  it('should display scanning instructions when scanner is active', async () => {
    Html5Qrcode.prototype.start = vi.fn().mockResolvedValue(undefined)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText(/Point your camera at the QR code/i)).toBeInTheDocument()
    })
  })

  it('should display help text for camera errors', async () => {
    const scanError = new Error('Permission denied')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(scanError)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('How to fix this:')).toBeInTheDocument()
    })

    expect(screen.getByText(/Click "Allow" when your browser asks/i)).toBeInTheDocument()
  })

  it('should display help text for no camera', async () => {
    Html5Qrcode.getCameras = vi.fn().mockResolvedValue([])

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('How to fix this:')).toBeInTheDocument()
    })

    expect(screen.getByText(/Make sure your device has a camera/i)).toBeInTheDocument()
    expect(screen.getByText(/Use manual code entry as an alternative/i)).toBeInTheDocument()
  })

  it('should show permission denied state when permission check returns denied', async () => {
    const mockPermissionStatus: PermissionStatus = {
      state: 'denied' as PermissionState,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }

    const originalPermissions = navigator.permissions
    Object.defineProperty(globalThis.navigator, 'permissions', {
      configurable: true,
      value: {
        query: vi.fn().mockResolvedValue(mockPermissionStatus),
      },
    })

    render(<QRScanner onScan={mockOnScan} onError={mockOnError} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Camera permission was denied/i)).toBeInTheDocument()
    expect(mockOnError).toHaveBeenCalledWith('Camera permission denied')

    Object.defineProperty(globalThis.navigator, 'permissions', {
      configurable: true,
      value: originalPermissions,
    })
  })

  it('should show NotAllowedError as permission denied state', async () => {
    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} onError={mockOnError} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Camera permission was denied by the browser/i)).toBeInTheDocument()
  })

  it('should show browser-specific instructions for Chrome', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/120.0',
      configurable: true,
    })

    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Click the lock icon in the address bar/i)).toBeInTheDocument()
    expect(screen.getByText(/Change it from "Block" to "Allow"/i)).toBeInTheDocument()
  })

  it('should show browser-specific instructions for Firefox', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Firefox/121.0',
      configurable: true,
    })

    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Click the info icon/i)).toBeInTheDocument()
    expect(screen.getByText(/Select "Always Allow" or "Allow"/i)).toBeInTheDocument()
  })

  it('should show browser-specific instructions for Safari', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 Safari/537.36',
      configurable: true,
    })

    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    expect(screen.getByText(/Go to Safari menu → Settings/i)).toBeInTheDocument()
    expect(screen.getByText(/Click the "Websites" tab/i)).toBeInTheDocument()
  })

  it('should display manual entry button when onManualEntry callback is provided', async () => {
    const mockManualEntry = vi.fn()
    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} onManualEntry={mockManualEntry} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    const manualButton = screen.getByRole('button', { name: /Enter Code Manually/i })
    expect(manualButton).toBeInTheDocument()
  })

  it('should call onManualEntry when manual entry button is clicked', async () => {
    const user = userEvent.setup()
    const mockManualEntry = vi.fn()
    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    render(<QRScanner onScan={mockOnScan} onManualEntry={mockManualEntry} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    const manualButton = screen.getByRole('button', { name: /Enter Code Manually/i })
    await user.click(manualButton)

    expect(mockManualEntry).toHaveBeenCalled()
  })

  it('should display orange styling for permission denied state', async () => {
    const permError = new Error('NotAllowedError')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(permError)

    const { container } = render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Permission Needed')).toBeInTheDocument()
    })

    const errorDiv = container.querySelector('.bg-orange-900\\/20')
    expect(errorDiv).toBeInTheDocument()
    expect(errorDiv).toHaveClass('border-orange-600/30')
  })

  it('should display red styling for other errors', async () => {
    const cameraError = new Error('Camera error')
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(cameraError)

    const { container } = render(<QRScanner onScan={mockOnScan} />)

    await waitFor(() => {
      expect(screen.getByText('Camera Access Error')).toBeInTheDocument()
    })

    const errorDiv = container.querySelector('.bg-red-900\\/20')
    expect(errorDiv).toBeInTheDocument()
    expect(errorDiv).toHaveClass('border-red-500/30')
  })
})
