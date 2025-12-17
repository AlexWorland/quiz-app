import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    user: null,
    token: null,
    isAuthenticated: false,
    login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
    }),
    logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
    }),
    setUser: (user) => set({ user }),
    updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
    })),
}), {
    name: 'auth-store',
    partialize: (state) => ({ user: state.user, token: state.token }),
}));
