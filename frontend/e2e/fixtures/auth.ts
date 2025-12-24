import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ensureMockApi } from './mockServer';
import { useMocks } from './api';

/**
 * Authentication fixtures for E2E tests
 * Provides helpers for login, registration, and auth state management
 */

export interface AuthUser {
  username: string;
  password: string;
  email?: string;
  avatar_url?: string;
  avatar_type?: 'emoji' | 'preset' | 'custom';
}

export const testUsers = {
  presenter: {
    username: 'test_presenter',
    password: 'testpass123',
    email: 'presenter@test.com',
  },
  participant: {
    username: 'test_participant',
    password: 'testpass123',
    email: 'participant@test.com',
  },
  admin: {
    username: 'test_admin',
    password: 'testpass123',
    email: 'admin@test.com',
  },
} as const;

/**
 * Register a new user
 * Forces clean state by unmounting React before navigation
 */
export async function registerUser(page: Page, user: AuthUser): Promise<void> {
  await ensureMockApi(page);
  if (useMocks) {
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('http://localhost:4173/'));
    await page.evaluate((u) => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            token: 'mock-token',
            user: {
              id: `user-${u.username}`,
              username: u.username,
              email: u.email ?? `${u.username}@example.com`,
              role: 'participant',
            },
            deviceId: `device-${u.username}`,
            sessionToken: `session-${u.username}`,
            isAuthenticated: true,
          },
        })
      );
    }, user);
    await page.goto('/home');
    return;
  }
  // Ensure we're logged out first - this unmounts React and clears storage
  await clearAuth(page);

  // Navigate to about:blank first to ensure clean state
  await page.goto('about:blank');
  await page.waitForTimeout(200);

  // Navigate to register with fresh React mount
  await page
    .goto('/register', { waitUntil: 'domcontentloaded', timeout: 10000 })
    .catch(() => page.goto('/register', { waitUntil: 'domcontentloaded' }));

  // Wait for React to fully hydrate
  await page.waitForTimeout(1500);

  // Verify we're on register page and auth is cleared
  const state = await page.evaluate(() => {
    try {
      const authStore = localStorage.getItem('auth-store');
      const hasAuth = authStore && JSON.parse(authStore)?.state?.token;
      return {
        hasAuth,
        path: window.location.pathname,
        url: window.location.href
      };
    } catch {
      return {
        hasAuth: false,
        path: window.location.pathname,
        url: window.location.href
      };
    }
  });

  if (state.hasAuth || !state.path.includes('/register')) {
    // State leaked or redirected - force clear and retry ONE more time
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.waitForTimeout(300);
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // Extra long wait on retry

    // Final check - throw error if still not on register
    const finalState = await page.evaluate(() => ({
      path: window.location.pathname,
      hasAuth: !!(localStorage.getItem('auth-store'))
    }));

    if (!finalState.path.includes('/register')) {
      throw new Error(`Unable to navigate to /register. Currently on ${finalState.path}. Has auth: ${finalState.hasAuth}`);
    }
  }

  // Wait for register page form to be visible
  try {
    await page.waitForSelector('h1:has-text("Join Quiz App")', { timeout: 8000 });
  } catch {
    const url = page.url();
    if (!url.includes('/register')) {
      throw new Error(`Expected registration page but on ${url}. Page may have redirected unexpectedly.`);
    }
    // Wait longer for slow component rendering
    await page.waitForTimeout(1500);
  }
  
  // Fill registration form
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  
  if (user.email) {
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      await emailInput.fill(user.email);
    }
  }

  // Select avatar if provided
  if (user.avatar_url || user.avatar_type) {
    // Click on emoji tab or upload tab based on avatar_type
    if (user.avatar_type === 'emoji') {
      // Wait for emoji grid to be visible
      await page.waitForSelector('button:has-text("😀"), button:has-text("😎")', { timeout: 2000 });
      
      // AvatarSelector should call onSelect on mount, but let's explicitly click an emoji to ensure it's selected
      // Find emoji buttons (they're in a grid, single character buttons)
      const emojiButton = page.locator('button').filter({ hasText: /^😀$/ }).first();
      if (await emojiButton.count() > 0) {
        await emojiButton.click();
        // Wait for React state update
        await page.waitForTimeout(500);
      }
      
      // Verify no "Avatar is required" error is showing
      const avatarError = page.locator('text=/Avatar is required/i');
      if (await avatarError.count() > 0) {
        // Try clicking another emoji
        const secondEmoji = page.locator('button').filter({ hasText: /^😎$/ }).first();
        if (await secondEmoji.count() > 0) {
          await secondEmoji.click();
          await page.waitForTimeout(500);
        }
      }
    }
  }

  // Submit form - wait for button to be visible and enabled
  const submitButton = page.getByRole('button', { name: /Create Account/i });
  await submitButton.waitFor({ state: 'visible', timeout: 5000 });
  await submitButton.click();
  
  // Wait for redirect to home or check for errors
  try {
    await page.waitForURL(/^\/(home|events)/, { timeout: 15000 });
  } catch (e) {
    // Check if there's an error message
    const errorElement = page.locator('text=/Registration failed|error|already exists/i');
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent();
      throw new Error(`Registration failed: ${errorText}`);
    }
    // If still on register page, might be validation error
    const currentUrl = page.url();
    if (currentUrl.includes('/register')) {
      // Check for validation errors
      const validationError = page.locator('text=/required|Avatar is required/i');
      if (await validationError.count() > 0) {
        throw new Error('Form validation failed - avatar might not be selected');
      }
    }
    throw e;
  }
}

/**
 * Login with credentials
 */
export async function loginUser(page: Page, username: string, password: string): Promise<void> {
  await ensureMockApi(page);
  if (useMocks) {
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => page.goto('http://localhost:4173/'));
    await page.evaluate((u) => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            token: 'mock-token',
            user: { id: `user-${u}`, username: u, email: `${u}@example.com`, role: 'participant' },
            deviceId: `device-${u}`,
            sessionToken: `session-${u}`,
            isAuthenticated: true,
          },
        })
      );
    }, username);
    await page.goto('/home');
    return;
  }
  const apiBase =
    process.env.E2E_API_URL ||
    process.env.VITE_API_URL ||
    'http://backend-test:8080';

  const response = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { username, password },
  });

  if (!response.ok()) {
    const body = await response.json().catch(() => ({}));
    const detail = (body && (body.detail || body.error)) || response.statusText();
    throw new Error(`Login API failed: ${response.status()} ${detail}`);
  }

  const data = await response.json();

  await page.evaluate((authData) => {
    localStorage.setItem(
      'auth-store',
      JSON.stringify({
        state: {
          token: authData.token,
          user: authData.user,
          deviceId: authData.user.id,
          sessionToken: authData.token,
          isAuthenticated: true,
        },
      })
    );
  }, data);

  await page.goto('/home', { waitUntil: 'domcontentloaded' });
}

/**
 * Logout current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Look for logout button (could be in header, menu, etc.)
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
  
  if (await logoutButton.count() > 0) {
    await logoutButton.first().click();
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {
      // If redirect doesn't happen, clear localStorage manually
    });
  }
  
  // Always clear localStorage as fallback
  await page.evaluate(() => {
    try {
      localStorage.removeItem('auth-store');
    } catch (e) {
      // Ignore errors
    }
  });
  
  // Navigate to login to ensure we're logged out
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    const token = await page.evaluate(() => {
      try {
        const authStore = localStorage.getItem('auth-store');
        if (!authStore) return false;
        const parsed = JSON.parse(authStore);
        return !!parsed.state?.token;
      } catch {
        return false;
      }
    });
    return token;
  } catch {
    return false;
  }
}

/**
 * Get current user from localStorage
 */
export async function getCurrentUser(page: Page): Promise<{ username?: string; role?: string } | null> {
  try {
    return await page.evaluate(() => {
      try {
        const authStore = localStorage.getItem('auth-store');
        if (!authStore) return null;
        const parsed = JSON.parse(authStore);
        return parsed.state?.user || null;
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}

/**
 * Clear authentication state
 * Forces complete React unmount/remount to prevent state leakage
 */
export async function clearAuth(page: Page): Promise<void> {
  try {
    // Step 1: Navigate to blank page to unmount React completely
    await page.goto('about:blank');

    // Step 2: Clear all localStorage while React is unmounted
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore errors
      }
    });

    // Step 3: Wait a moment to ensure storage operations complete
    await page.waitForTimeout(300);

    // Step 4: Navigate to login page with fresh React mount
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {
      return page.goto('/login', { waitUntil: 'domcontentloaded' });
    });

    // Step 5: Wait for React to fully hydrate with EMPTY storage
    await page.waitForTimeout(1500);

    // Step 6: Verify auth is cleared and we're on login page
    const result = await page.evaluate(() => {
      try {
        const authStore = localStorage.getItem('auth-store');
        const hasAuth = authStore && JSON.parse(authStore)?.state?.token;
        const onLoginPage = window.location.pathname.includes('/login');
        return { hasAuth, onLoginPage, path: window.location.pathname };
      } catch {
        return { hasAuth: false, onLoginPage: window.location.pathname.includes('/login'), path: window.location.pathname };
      }
    });

    // If still authenticated or not on login page, force clear again
    if (result.hasAuth || !result.onLoginPage) {
      await page.goto('about:blank');
      await page.evaluate(() => localStorage.clear());
      await page.waitForTimeout(300);
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    // Ultimate fallback
    try {
      await page.goto('about:blank');
      await page.evaluate(() => localStorage.clear());
      await page.waitForTimeout(300);
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    } catch {
      // Give up
    }
  }
}

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<{
  authenticatedPage: Page;
  presenterPage: Page;
  participantPage: Page;
}>({
  authenticatedPage: async ({ page }, use) => {
    await loginUser(page, testUsers.participant.username, testUsers.participant.password);
    await use(page);
    await clearAuth(page);
  },

  presenterPage: async ({ page }, use) => {
    await loginUser(page, testUsers.presenter.username, testUsers.presenter.password);
    await use(page);
    await clearAuth(page);
  },

  participantPage: async ({ page }, use) => {
    await loginUser(page, testUsers.participant.username, testUsers.participant.password);
    await use(page);
    await clearAuth(page);
  },
});

export { expect };

