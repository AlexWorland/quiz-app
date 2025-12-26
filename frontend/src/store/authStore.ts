import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  username: string
  email: string
  role: 'presenter' | 'participant'
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
  created_at?: string
}

interface AuthStore {
  user: User | null
  token: string | null
  deviceId: string | null
  sessionToken: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
  updateUser: (updates: Partial<User>) => void
  setDeviceInfo: (deviceId: string, sessionToken: string) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      deviceId: null,
      sessionToken: null,
      isAuthenticated: false,
      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          deviceId: null,
          sessionToken: null,
          isAuthenticated: false,
        }),
      setUser: (user) => set({ user }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
      setDeviceInfo: (deviceId, sessionToken) => set({ deviceId, sessionToken }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        deviceId: state.deviceId, 
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
)
