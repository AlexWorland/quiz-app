import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinEvent } from '../JoinEvent'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { joinEvent } from '../../api/endpoints'

// Mock the API and utilities
vi.mock('../../api/endpoints', () => ({
  joinEvent: vi.fn(),
}))

vi.mock('../../utils/deviceFingerprint', () => ({
  getOrCreateDeviceFingerprint: vi.fn(() => 'test-device-id'),
}))

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    setDeviceInfo: vi.fn(),
  })),
}))

const mockJoinEvent = vi.mocked(joinEvent)

describe('JoinEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders QR scanner UI without manual input', () => {
    render(
      <MemoryRouter>
        <JoinEvent />
      </MemoryRouter>
    )

    // Should show QR scanner message
    expect(screen.getByText('Scan the QR code displayed on the screen to join the event')).toBeInTheDocument()

    // Should show QR scanner placeholder
    expect(screen.getByText('QR Scanner loading...')).toBeInTheDocument()

    // Should show camera permission instructions
    expect(screen.getByText(/💡 Enable camera access/)).toBeInTheDocument()

    // Should NOT have manual input field
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // Should NOT have manual join button
    expect(screen.queryByRole('button', { name: /join/i })).not.toBeInTheDocument()
  })

  it('handles URL parameter join code', async () => {
    const mockResponse = {
      data: {
        eventId: 'test-event-id',
        deviceId: 'test-device-id',
        sessionToken: 'test-session-token',
      },
    }
    mockJoinEvent.mockResolvedValueOnce(mockResponse)

    render(
      <MemoryRouter initialEntries={['/join?code=ABC123']}>
        <JoinEvent />
      </MemoryRouter>
    )

    // Wait for useEffect to trigger join
    await waitFor(() => {
      expect(mockJoinEvent).toHaveBeenCalledWith('ABC123', 'test-device-id')
    })
  })

  it('shows error message on join failure', async () => {
    mockJoinEvent.mockRejectedValueOnce(new Error('Event not found'))

    render(
      <MemoryRouter initialEntries={['/join?code=INVALID']}>
        <JoinEvent />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Event not found. Make sure you scanned the correct QR code.')).toBeInTheDocument()
    })
  })
})