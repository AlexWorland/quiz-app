import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinEvent } from '../JoinEvent'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { joinEvent, getEventByJoinCode } from '../../api/endpoints'

// Helper to flush promise queue
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

// Mock the navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the API
vi.mock('../../api/endpoints', () => ({
  joinEvent: vi.fn(),
  getEventByJoinCode: vi.fn(),
  recoverParticipant: vi.fn(),
}))

vi.mock('../../utils/deviceFingerprint', () => ({
  getOrCreateDeviceFingerprint: vi.fn(() => 'test-device-uuid'),
}))

// Create a stable mock for setDeviceInfo that we can reference
const mockSetDeviceInfo = vi.fn()
vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: (state: { setDeviceInfo: typeof mockSetDeviceInfo }) => unknown) =>
    selector({ setDeviceInfo: mockSetDeviceInfo }),
}))

// Mock webrtc detection to return unsupported so we show manual entry first (desktop device)
vi.mock('../../utils/webrtcDetection', () => ({
  detectWebRTCSupport: vi.fn(() => ({ isSupported: false, reason: 'desktop_device' })),
  getWebRTCErrorMessage: vi.fn(() => 'QR scanning works best on mobile devices. Please enter the code manually below.'),
  isMobileDevice: vi.fn(() => false),
}))

// Mock QRScanner component
vi.mock('../../components/event/QRScanner', () => ({
  QRScanner: () => <div data-testid="qr-scanner">QR Scanner</div>,
}))

const mockJoinEvent = vi.mocked(joinEvent)
const mockGetEventByJoinCode = vi.mocked(getEventByJoinCode)

describe('JoinEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to navigate from QR scan to manual code entry
  // Uses provided userEvent instance to avoid creating multiple setup() calls
  const navigateToCodeEntry = async (user: ReturnType<typeof userEvent.setup>) => {
    // With WebRTC unsupported, we'll see the notice with "Enter Code Manually" button
    const manualEntryButton = await screen.findByRole('button', { name: /Enter Code Manually/i })
    await user.click(manualEntryButton)
  }

  it('renders the code entry step initially', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // First we see the QR scan step with desktop device notice
    expect(screen.getByText('Join Event')).toBeInTheDocument()
    // Desktop devices show a notice about QR scanning being for mobile
    expect(screen.getByText(/QR scanning works best on mobile/i)).toBeInTheDocument()

    // Navigate to code entry
    await navigateToCodeEntry(user)

    // Now we should see the code entry form
    expect(screen.getByPlaceholderText('Enter 6-character code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('validates event code before showing details form', async () => {
    const user = userEvent.setup()

    mockGetEventByJoinCode.mockResolvedValueOnce({
      data: {
        id: 'event-123',
        title: 'Test Quiz Event',
        join_code: 'ABC123',
        status: 'waiting',
        host_id: 'host-123',
        mode: 'normal',
        num_fake_answers: 3,
        time_per_question: 30,
        join_locked: false,
        created_at: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // Navigate to code entry first
    await navigateToCodeEntry(user)

    // Enter code
    await user.type(screen.getByPlaceholderText('Enter 6-character code'), 'ABC123')

    // Click continue
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Should show event title and details form
    await waitFor(() => {
      expect(screen.getByText(/Joining: Test Quiz Event/)).toBeInTheDocument()
    })

    // Should show display name input
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
  })

  it('shows error for invalid event code', async () => {
    const user = userEvent.setup()

    mockGetEventByJoinCode.mockRejectedValueOnce(new Error('Event not found'))

    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // Navigate to code entry first
    await navigateToCodeEntry(user)

    await user.type(screen.getByPlaceholderText('Enter 6-character code'), 'INVALID')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/Event not found/)).toBeInTheDocument()
    })
  })

  it('joins event with display name and avatar', async () => {
    const user = userEvent.setup()

    mockGetEventByJoinCode.mockResolvedValueOnce({
      data: {
        id: 'event-123',
        title: 'Test Event',
        join_code: 'ABC123',
        status: 'waiting',
        host_id: 'host-123',
        mode: 'normal',
        num_fake_answers: 3,
        time_per_question: 30,
        join_locked: false,
        created_at: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    // Use mockImplementation to verify the mock is actually being called
    mockJoinEvent.mockImplementation(() => {
      console.log('>>> joinEvent mock was called!')
      return Promise.resolve({
        data: {
          eventId: 'event-123',
          deviceId: 'device-123',
          sessionToken: 'token-123',
          displayName: 'Test Player',
          isRejoining: false,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as never,
      })
    })

    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // Navigate to code entry first
    await navigateToCodeEntry(user)

    // Step 1: Enter code
    await user.type(screen.getByPlaceholderText('Enter 6-character code'), 'ABC123')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: Enter details
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Test Player')

    // Click join and wait for async operations
    await user.click(screen.getByRole('button', { name: /join event/i }))

    // Wait for joinEvent to be called
    await waitFor(() => {
      expect(mockJoinEvent).toHaveBeenCalled()
    })

    // Verify the call parameters
    expect(mockJoinEvent).toHaveBeenCalledWith({
      code: 'ABC123',
      deviceFingerprint: 'test-device-uuid',
      display_name: 'Test Player',
      avatar_url: expect.any(String),
      avatar_type: 'emoji',
    })

    // Check what the mock actually returned
    const mockResult = await mockJoinEvent.mock.results[0]?.value
    console.log('Mock result:', mockResult)
    console.log('setDeviceInfo called:', mockSetDeviceInfo.mock.calls)
    console.log('navigate called:', mockNavigate.mock.calls)

    // Give React time to process the state updates
    await act(async () => {
      await flushPromises()
    })

    console.log('After flush - setDeviceInfo called:', mockSetDeviceInfo.mock.calls)
    console.log('After flush - navigate called:', mockNavigate.mock.calls)

    // Wait for navigation after the promise resolves
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/events/event-123')
    }, { timeout: 3000 })
  })

  it('pre-fills code from URL parameter', async () => {
    // When code is in URL, it goes directly to enter_details step
    mockGetEventByJoinCode.mockResolvedValueOnce({
      data: {
        id: 'event-123',
        title: 'Test Event',
        join_code: 'XYZ789',
        status: 'waiting',
        host_id: 'host-123',
        mode: 'normal',
        num_fake_answers: 3,
        time_per_question: 30,
        join_locked: false,
        created_at: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    render(
      <MemoryRouter initialEntries={['/join?code=XYZ789']}>
        <JoinEvent />
      </MemoryRouter>
    )

    // With code in URL, component goes to enter_details step directly
    // Just verify the code is displayed
    await waitFor(() => {
      expect(screen.getByText('Code: XYZ789')).toBeInTheDocument()
    })
  })

  it('allows going back to code entry from details step', async () => {
    const user = userEvent.setup()

    mockGetEventByJoinCode.mockResolvedValueOnce({
      data: {
        id: 'event-123',
        title: 'Test Event',
        join_code: 'ABC123',
        status: 'waiting',
        host_id: 'host-123',
        mode: 'normal',
        num_fake_answers: 3,
        time_per_question: 30,
        join_locked: false,
        created_at: new Date().toISOString(),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as never,
    })

    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // Navigate to code entry first
    await navigateToCodeEntry(user)

    // Go to step 2 (enter_details)
    await user.type(screen.getByPlaceholderText('Enter 6-character code'), 'ABC123')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(screen.getByText(/← Back/)).toBeInTheDocument()
    })

    // Go back
    await user.click(screen.getByText(/← Back/))

    // Should be back on code entry step
    expect(screen.getByPlaceholderText('Enter 6-character code')).toBeInTheDocument()
  })
})
