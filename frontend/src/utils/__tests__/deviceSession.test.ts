import { describe, it, expect, beforeEach } from 'vitest'
import {
  setCurrentEventSession,
  getCurrentEventSession,
  clearCurrentEventSession,
  isDeviceInEvent,
  getEventConflictInfo,
  validateEventJoin,
  getCurrentEventDuration
} from '../deviceSession'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('deviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('setCurrentEventSession', () => {
    it('should store event session in localStorage', () => {
      const eventId = 'event-123'
      const eventTitle = 'Test Event'
      const sessionToken = 'token-456'

      setCurrentEventSession(eventId, eventTitle, sessionToken)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'current_device_session',
        expect.stringContaining(eventId)
      )

      const storedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(storedData.eventId).toBe(eventId)
      expect(storedData.eventTitle).toBe(eventTitle)
      expect(storedData.sessionToken).toBe(sessionToken)
      expect(storedData.joinedAt).toBeTruthy()
    })
  })

  describe('getCurrentEventSession', () => {
    it('should return null when no session exists', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const session = getCurrentEventSession()

      expect(session).toBeNull()
    })

    it('should return session when exists', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date().toISOString(),
        sessionToken: 'token-456'
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const session = getCurrentEventSession()

      expect(session).toEqual(sessionData)
    })

    it('should return null when localStorage data is corrupted', () => {
      localStorageMock.getItem.mockReturnValue('invalid json')

      const session = getCurrentEventSession()

      expect(session).toBeNull()
    })
  })

  describe('clearCurrentEventSession', () => {
    it('should remove session from localStorage', () => {
      clearCurrentEventSession()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('current_device_session')
    })
  })

  describe('isDeviceInEvent', () => {
    it('should return false when no session exists', () => {
      localStorageMock.getItem.mockReturnValue(null)

      expect(isDeviceInEvent()).toBe(false)
    })

    it('should return true when device is in any event', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date().toISOString()
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      expect(isDeviceInEvent()).toBe(true)
    })

    it('should check specific event ID', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date().toISOString()
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      expect(isDeviceInEvent('event-123')).toBe(true)
      expect(isDeviceInEvent('event-456')).toBe(false)
    })
  })

  describe('validateEventJoin', () => {
    it('should allow join when no current session', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const validation = validateEventJoin('event-123')

      expect(validation.allowed).toBe(true)
      expect(validation.conflict).toBeUndefined()
    })

    it('should allow rejoin to same event', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date().toISOString()
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const validation = validateEventJoin('event-123')

      expect(validation.allowed).toBe(true)
    })

    it('should prevent join to different event', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Current Event',
        joinedAt: new Date().toISOString()
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const validation = validateEventJoin('event-456')

      expect(validation.allowed).toBe(false)
      expect(validation.conflict).toEqual({
        eventId: 'event-123',
        eventTitle: 'Current Event',
        joinedAt: expect.any(Date)
      })
    })
  })

  describe('getEventConflictInfo', () => {
    it('should return null when no session', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const conflict = getEventConflictInfo()

      expect(conflict).toBeNull()
    })

    it('should return conflict info when session exists', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: '2024-01-01T10:00:00.000Z'
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const conflict = getEventConflictInfo()

      expect(conflict).toEqual({
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T10:00:00.000Z')
      })
    })
  })

  describe('getCurrentEventDuration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T10:30:00'))
    })

    it('should return null when no session', () => {
      localStorageMock.getItem.mockReturnValue(null)

      const duration = getCurrentEventDuration()

      expect(duration).toBeNull()
    })

    it('should return "just joined" for very recent joins', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T10:29:30').toISOString() // 30 seconds ago
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const duration = getCurrentEventDuration()

      expect(duration).toBe('just joined')
    })

    it('should return minutes for recent joins', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T10:25:00').toISOString() // 5 minutes ago
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const duration = getCurrentEventDuration()

      expect(duration).toBe('5 minutes ago')
    })

    it('should handle single minute', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T10:29:00').toISOString() // 1 minute ago
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const duration = getCurrentEventDuration()

      expect(duration).toBe('1 minute ago')
    })

    it('should return hours for longer durations', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T08:30:00').toISOString() // 2 hours ago
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const duration = getCurrentEventDuration()

      expect(duration).toBe('2 hours ago')
    })

    it('should handle single hour', () => {
      const sessionData = {
        eventId: 'event-123',
        eventTitle: 'Test Event',
        joinedAt: new Date('2024-01-01T09:30:00').toISOString() // 1 hour ago
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const duration = getCurrentEventDuration()

      expect(duration).toBe('1 hour ago')
    })
  })
})
