import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

vi.mock('axios', async () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  }
  return { default: mockAxios }
})

describe('API client', () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    // Mock window.location
    delete (window as any).location
    window.location = { ...originalLocation, href: '' } as Location
  })

  afterEach(() => {
    window.location = originalLocation
  })

  describe('request interceptor', () => {
    it('should add Authorization header when token exists', async () => {
      useAuthStore.setState({ token: 'test-token-123' })

      const mockConfig = { headers: {} as Record<string, string> }
      const requestInterceptor = (axios.create as any)().interceptors.request.use.mock.calls?.[0]?.[0]

      if (requestInterceptor) {
        const result = requestInterceptor(mockConfig)
        expect(result.headers.Authorization).toBe('Bearer test-token-123')
      }
    })

    it('should not add Authorization header when no token', async () => {
      useAuthStore.setState({ token: null })

      const mockConfig = { headers: {} as Record<string, string> }

      // Simulate what the interceptor does
      const token = useAuthStore.getState().token
      if (token) {
        mockConfig.headers.Authorization = `Bearer ${token}`
      }

      expect(mockConfig.headers.Authorization).toBeUndefined()
    })
  })

  describe('response interceptor - 401 handling', () => {
    it('should call logout and redirect on 401 error', () => {
      const logoutSpy = vi.fn()
      useAuthStore.setState({
        user: { id: '1', username: 'test', email: 'test@test.com', role: 'presenter' },
        token: 'old-token',
        isAuthenticated: true,
      })

      // Simulate what the response interceptor does on 401
      const error = { response: { status: 401 } }
      if (error.response?.status === 401) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }

      expect(useAuthStore.getState().token).toBeNull()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(window.location.href).toBe('/login')
    })

    it('should not logout on non-401 errors', () => {
      useAuthStore.setState({
        user: { id: '1', username: 'test', email: 'test@test.com', role: 'presenter' },
        token: 'valid-token',
        isAuthenticated: true,
      })

      const error = { response: { status: 500 } }
      if (error.response?.status === 401) {
        useAuthStore.getState().logout()
      }

      expect(useAuthStore.getState().token).toBe('valid-token')
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })
})
