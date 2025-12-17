import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, User } from '../authStore'

const mockUser: User = {
  id: 'user-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'presenter',
  avatar_url: 'https://example.com/avatar.png',
  avatar_type: 'preset',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    localStorage.clear()
  })

  describe('login', () => {
    it('should set user, token, and isAuthenticated to true', () => {
      const token = 'jwt-token-123'

      useAuthStore.getState().login(mockUser, token)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.token).toBe(token)
      expect(state.isAuthenticated).toBe(true)
    })
  })

  describe('logout', () => {
    it('should clear user, token, and set isAuthenticated to false', () => {
      useAuthStore.setState({
        user: mockUser,
        token: 'jwt-token-123',
        isAuthenticated: true,
      })

      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('setUser', () => {
    it('should update the user object', () => {
      const newUser: User = { ...mockUser, username: 'newusername' }

      useAuthStore.getState().setUser(newUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(newUser)
    })
  })

  describe('updateUser', () => {
    it('should partially update user properties', () => {
      useAuthStore.setState({ user: mockUser })

      useAuthStore.getState().updateUser({ username: 'updated' })

      const state = useAuthStore.getState()
      expect(state.user?.username).toBe('updated')
      expect(state.user?.email).toBe(mockUser.email)
      expect(state.user?.role).toBe(mockUser.role)
    })

    it('should handle null user gracefully', () => {
      useAuthStore.setState({ user: null })

      useAuthStore.getState().updateUser({ username: 'updated' })

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
    })

    it('should update avatar properties', () => {
      useAuthStore.setState({ user: mockUser })

      useAuthStore.getState().updateUser({
        avatar_url: 'new-avatar.png',
        avatar_type: 'emoji',
      })

      const state = useAuthStore.getState()
      expect(state.user?.avatar_url).toBe('new-avatar.png')
      expect(state.user?.avatar_type).toBe('emoji')
    })
  })

  describe('persistence', () => {
    it('should persist user and token to localStorage', () => {
      const token = 'jwt-token-123'

      useAuthStore.getState().login(mockUser, token)

      const stored = JSON.parse(localStorage.getItem('auth-store') || '{}')
      expect(stored.state?.user).toEqual(mockUser)
      expect(stored.state?.token).toBe(token)
    })

    it('should not persist isAuthenticated (derived from user/token presence)', () => {
      useAuthStore.getState().login(mockUser, 'token')

      const stored = JSON.parse(localStorage.getItem('auth-store') || '{}')
      expect(stored.state?.isAuthenticated).toBeUndefined()
    })
  })
})
