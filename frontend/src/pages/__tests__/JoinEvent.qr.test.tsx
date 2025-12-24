import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { JoinEvent } from '../JoinEvent'
import * as endpoints from '../../api/endpoints'
import { Html5Qrcode } from 'html5-qrcode'

// Mock dependencies
vi.mock('../../api/endpoints')
vi.mock('html5-qrcode')
vi.mock('../../utils/deviceFingerprint', () => ({
  getOrCreateDeviceFingerprint: () => 'test-device-id'
}))

// Mock webrtc detection as supported for QR scanner tests (simulating mobile)
vi.mock('../../utils/webrtcDetection', () => ({
  detectWebRTCSupport: vi.fn(() => ({ isSupported: true })),
  getWebRTCErrorMessage: vi.fn(() => ''),
  isMobileDevice: vi.fn(() => true),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  }
})

describe('JoinEvent with QR Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Html5Qrcode
    Html5Qrcode.getCameras = vi.fn().mockResolvedValue([
      { id: 'camera1', label: 'Back Camera' }
    ])
    Html5Qrcode.prototype.start = vi.fn().mockResolvedValue(undefined)
    Html5Qrcode.prototype.stop = vi.fn().mockResolvedValue(undefined)
    Html5Qrcode.prototype.clear = vi.fn()
  })

  it('should show QR scanner as primary method', async () => {
    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    expect(screen.getByText('Join Event')).toBeInTheDocument()
    expect(screen.getByText(/Scan the QR code shown on the presenter's screen/i)).toBeInTheDocument()
    expect(screen.getByText(/Can't scan\? Enter code manually/i)).toBeInTheDocument()
  })

  it('should handle successful QR scan with URL', async () => {
    const mockEvent = { id: 'event-123', title: 'Test Event', join_code: 'ABC123' }
    vi.mocked(endpoints.getEventByJoinCode).mockResolvedValue({
      data: mockEvent
    } as any)

    let scanCallback: ((text: string) => void) | null = null
    Html5Qrcode.prototype.start = vi.fn().mockImplementation((_, __, onSuccess) => {
      scanCallback = onSuccess
      return Promise.resolve()
    })

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    // Simulate QR scan
    if (scanCallback) {
      scanCallback('https://example.com/join/ABC123')
    }

    await waitFor(() => {
      expect(endpoints.getEventByJoinCode).toHaveBeenCalledWith('ABC123')
    })
  })

  it('should extract code from QR URL with query param', async () => {
    const mockEvent = { id: 'event-123', title: 'Test Event', join_code: 'XYZ789' }
    vi.mocked(endpoints.getEventByJoinCode).mockResolvedValue({
      data: mockEvent
    } as any)

    let scanCallback: ((text: string) => void) | null = null
    Html5Qrcode.prototype.start = vi.fn().mockImplementation((_, __, onSuccess) => {
      scanCallback = onSuccess
      return Promise.resolve()
    })

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    if (scanCallback) {
      scanCallback('https://example.com/join?code=XYZ789')
    }

    await waitFor(() => {
      expect(endpoints.getEventByJoinCode).toHaveBeenCalledWith('XYZ789')
    })
  })

  it('should show error for invalid QR code', async () => {
    let scanCallback: ((text: string) => void) | null = null
    Html5Qrcode.prototype.start = vi.fn().mockImplementation((_, __, onSuccess) => {
      scanCallback = onSuccess
      return Promise.resolve()
    })

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    if (scanCallback) {
      scanCallback('invalid-qr-code')
    }

    await waitFor(() => {
      expect(screen.getByText(/Invalid QR code/i)).toBeInTheDocument()
    })
  })

  it('should show error for expired event', async () => {
    vi.mocked(endpoints.getEventByJoinCode).mockRejectedValue(
      new Error('Event not found')
    )

    let scanCallback: ((text: string) => void) | null = null
    Html5Qrcode.prototype.start = vi.fn().mockImplementation((_, __, onSuccess) => {
      scanCallback = onSuccess
      return Promise.resolve()
    })

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    if (scanCallback) {
      scanCallback('https://example.com/join/ABC123')
    }

    await waitFor(() => {
      expect(screen.getByText(/Event not found or has expired/i)).toBeInTheDocument()
    })
  })

  it('should show error for locked event', async () => {
    vi.mocked(endpoints.getEventByJoinCode).mockRejectedValue(
      new Error('403 Forbidden')
    )

    let scanCallback: ((text: string) => void) | null = null
    Html5Qrcode.prototype.start = vi.fn().mockImplementation((_, __, onSuccess) => {
      scanCallback = onSuccess
      return Promise.resolve()
    })

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(Html5Qrcode.prototype.start).toHaveBeenCalled()
    })

    if (scanCallback) {
      scanCallback('https://example.com/join/ABC123')
    }

    await waitFor(() => {
      expect(screen.getByText(/not accepting new participants/i)).toBeInTheDocument()
    })
  })

  it('should allow switching to manual code entry', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    const manualButton = screen.getByText(/Can't scan\? Enter code manually/i)
    await user.click(manualButton)

    expect(screen.getByText(/Enter the event code manually/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Enter 6-character code/i)).toBeInTheDocument()
  })

  it('should allow switching back to QR scan from manual entry', async () => {
    const user = userEvent.setup()

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    // Go to manual entry
    const manualButton = screen.getByText(/Can't scan\? Enter code manually/i)
    await user.click(manualButton)

    // Go back to QR scan
    const backButton = screen.getByText(/← Back to QR scan/i)
    await user.click(backButton)

    expect(screen.getByText(/Scan the QR code/i)).toBeInTheDocument()
  })

  it('should fallback to manual entry on QR scanner error', async () => {
    Html5Qrcode.prototype.start = vi.fn().mockRejectedValue(new Error('Camera error'))

    render(
      <BrowserRouter>
        <JoinEvent />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText(/Can't scan\? Enter code manually/i)).toBeInTheDocument()
    })
  })
})
