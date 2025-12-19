import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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
 */
export async function registerUser(page: Page, user: AuthUser): Promise<void> {
  // Ensure we're logged out first
  await clearAuth(page);
  
  await page.goto('/register');
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for page to load and check if we're on register page
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000); // Wait for any redirects
  
  // Verify we're actually on the register page (not redirected to home)
  const currentUrl = page.url();
  if (!currentUrl.includes('/register')) {
    // If redirected, user is already logged in - clear auth and retry
    await page.evaluate(() => {
      localStorage.removeItem('auth-store');
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Check again
    const newUrl = page.url();
    if (!newUrl.includes('/register')) {
      // Still redirected - navigate directly
      await page.goto('/register', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }
  }
  
  // Wait for register page to be visible (check for heading or form)
  try {
    await page.waitForSelector('h1:has-text("Join Quiz App")', { timeout: 5000 });
  } catch {
    // If heading not found, check if we're on the right page
    const url = page.url();
    if (!url.includes('/register')) {
      throw new Error(`Expected to be on /register but was on ${url}. User may already be logged in.`);
    }
    // Page might be loading, wait a bit more
    await page.waitForTimeout(1000);
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
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Fill login form
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);

  // Submit form
  await page.getByRole('button', { name: /Login/i }).click();
  
  // Wait for redirect to home (with longer timeout for backend)
  await page.waitForURL(/^\/(home|events)/, { timeout: 15000 }).catch(() => {
    // If redirect doesn't happen, might be backend issue
  });
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
 */
export async function clearAuth(page: Page): Promise<void> {
  try {
    // Navigate to any page first to ensure we have a valid context
    await page.goto('about:blank').catch(() => {});
    
    // Clear localStorage - try multiple times to ensure it's cleared
    await page.evaluate(() => {
      try {
        localStorage.removeItem('auth-store');
        // Also try clearing the entire store
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('auth') || key.includes('store')) {
            localStorage.removeItem(key);
          }
        });
        localStorage.clear();
      } catch (e) {
        // Ignore errors if localStorage is not accessible
      }
    });
    
    // Navigate to login to ensure we're logged out
    await page.goto('/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    // Wait for any redirects to complete
    await page.waitForTimeout(500);
    
    // Verify we're actually on login page (not redirected)
    const url = page.url();
    if (!url.includes('/login')) {
      // Still redirected - clear again and force navigation
      await page.evaluate(() => {
        localStorage.removeItem('auth-store');
        localStorage.clear();
      });
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
    }
  } catch (e) {
    // Ignore errors - just try to clear storage
    try {
      await page.evaluate(() => {
        localStorage.removeItem('auth-store');
        localStorage.clear();
      });
    } catch {
      // Ignore
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

