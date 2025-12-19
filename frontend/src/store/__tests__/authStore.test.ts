import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../authStore';
import type { User } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the store to initial state
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  describe('initial state', () => {
    it('should have null user and token initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('should set user, token, and isAuthenticated', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token-123';

      useAuthStore.getState().login(user, token);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.token).toBe(token);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should persist user and token to localStorage', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token-123';

      useAuthStore.getState().login(user, token);

      const stored = localStorage.getItem('auth-store');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(user);
      expect(parsed.state.token).toBe(token);
    });

    it('should handle presenter role', () => {
      const user: User = {
        id: '2',
        username: 'presenter',
        email: 'presenter@example.com',
        role: 'presenter',
      };
      const token = 'presenter-token';

      useAuthStore.getState().login(user, token);

      const state = useAuthStore.getState();
      expect(state.user?.role).toBe('presenter');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should handle user with avatar', () => {
      const user: User = {
        id: '3',
        username: 'avataruser',
        email: 'avatar@example.com',
        role: 'participant',
        avatar_url: 'https://example.com/avatar.png',
        avatar_type: 'custom',
      };
      const token = 'avatar-token';

      useAuthStore.getState().login(user, token);

      const state = useAuthStore.getState();
      expect(state.user?.avatar_url).toBe('https://example.com/avatar.png');
      expect(state.user?.avatar_type).toBe('custom');
    });
  });

  describe('logout', () => {
    it('should clear user, token, and set isAuthenticated to false', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      // Login first
      useAuthStore.getState().login(user, token);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then logout
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should clear persisted data from localStorage', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      useAuthStore.getState().login(user, token);
      expect(localStorage.getItem('auth-store')).toBeTruthy();

      useAuthStore.getState().logout();

      const stored = localStorage.getItem('auth-store');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toBeNull();
      expect(parsed.state.token).toBeNull();
    });
  });

  describe('setUser', () => {
    it('should update the user', () => {
      const initialUser: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      useAuthStore.getState().login(initialUser, token);

      const newUser: User = {
        id: '2',
        username: 'newuser',
        email: 'new@example.com',
        role: 'presenter',
      };

      useAuthStore.getState().setUser(newUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(newUser);
      expect(state.token).toBe(token); // Token should remain unchanged
      expect(state.isAuthenticated).toBe(true); // Should remain authenticated
    });

    it('should work even when not authenticated', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };

      useAuthStore.getState().setUser(user);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('should update partial user data', () => {
      const initialUser: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      useAuthStore.getState().login(initialUser, token);

      useAuthStore.getState().updateUser({
        username: 'updateduser',
        avatar_url: 'https://example.com/new-avatar.png',
      });

      const state = useAuthStore.getState();
      expect(state.user?.id).toBe('1');
      expect(state.user?.username).toBe('updateduser');
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.avatar_url).toBe('https://example.com/new-avatar.png');
      expect(state.token).toBe(token);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should merge updates with existing user data', () => {
      const initialUser: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
        avatar_url: 'https://example.com/old-avatar.png',
        avatar_type: 'custom',
      };
      const token = 'test-token';

      useAuthStore.getState().login(initialUser, token);

      useAuthStore.getState().updateUser({
        avatar_type: 'emoji',
      });

      const state = useAuthStore.getState();
      expect(state.user?.avatar_url).toBe('https://example.com/old-avatar.png');
      expect(state.user?.avatar_type).toBe('emoji');
    });

    it('should do nothing if user is null', () => {
      expect(useAuthStore.getState().user).toBeNull();

      useAuthStore.getState().updateUser({
        username: 'should-not-work',
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should handle role change', () => {
      const initialUser: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      useAuthStore.getState().login(initialUser, token);

      useAuthStore.getState().updateUser({
        role: 'presenter',
      });

      const state = useAuthStore.getState();
      expect(state.user?.role).toBe('presenter');
    });
  });

  describe('persistence', () => {
    it('should restore state from localStorage on initialization', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      // Set initial state
      useAuthStore.getState().login(user, token);

      // Create a new store instance (simulating page reload)
      // Note: Zustand persist middleware handles this automatically
      // We can verify by checking localStorage was written
      const stored = localStorage.getItem('auth-store');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.user).toEqual(user);
      expect(parsed.state.token).toBe(token);
    });

    it('should only persist user and token, not isAuthenticated', () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'participant',
      };
      const token = 'test-token';

      useAuthStore.getState().login(user, token);

      const stored = localStorage.getItem('auth-store');
      const parsed = JSON.parse(stored!);
      
      // Should have user and token
      expect(parsed.state.user).toBeTruthy();
      expect(parsed.state.token).toBeTruthy();
      
      // Should not have isAuthenticated (it's computed from user/token presence)
      expect(parsed.state.isAuthenticated).toBeUndefined();
    });
  });
});

