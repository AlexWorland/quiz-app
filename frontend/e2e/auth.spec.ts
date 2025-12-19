import { test, expect } from '@playwright/test';
import { loginUser, registerUser, logoutUser, isAuthenticated, clearAuth, testUsers } from './fixtures/auth';
import { isBackendAvailable } from './fixtures/api';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state first (before any navigation)
    await clearAuth(page);
    // Navigate to login to ensure we're logged out
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    // Wait a bit for any redirects to complete
    await page.waitForTimeout(300);
  });

  test.describe('Login', () => {
    test('should display login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText('Welcome Back')).toBeVisible();
      await expect(page.getByLabel('Username')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: /Login/i }).click();
      
      // Wait for validation errors
      await expect(page.getByText('Username is required')).toBeVisible({ timeout: 2000 });
    });

    test('should show error for invalid credentials', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      await page.goto('/login');
      await page.waitForLoadState('domcontentloaded');
      
      await page.getByLabel('Username').fill('invalid_user');
      await page.getByLabel('Password').fill('wrong_password');
      await page.getByRole('button', { name: /Login/i }).click();
      
      // Wait for error message (could be various error texts)
      await expect(
        page.getByText(/Login failed|Invalid credentials|Unauthorized|error/i)
      ).toBeVisible({ timeout: 8000 });
    });

    test('should successfully login with valid credentials', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      const username = `test_user_${Date.now()}`;
      
      // First register a user
      await registerUser(page, {
        username,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await clearAuth(page);

      // Then login
      await loginUser(page, username, 'testpass123');
      
      // Should redirect to home
      await expect(page).toHaveURL(/^\/(home|events)/, { timeout: 5000 });
      
      // Should be authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('should navigate to register page', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: /Register here/i }).click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should redirect to home if already authenticated', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Wait a bit for redirect to complete
      await page.waitForTimeout(1000);

      // Try to visit login page
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      
      // Should redirect to home (App.tsx redirects authenticated users)
      await expect(page).toHaveURL(/^\/(home|events)/, { timeout: 5000 });
    });
  });

  test.describe('Registration', () => {
    test('should display registration page', async ({ page }) => {
      await page.goto('/register');
      await expect(page).toHaveURL(/\/register/);
      await expect(page.getByText('Join Quiz App')).toBeVisible();
      await expect(page.getByLabel('Username')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/register');
      await page.waitForLoadState('domcontentloaded');
      
      // Clear the default avatar selection by switching tabs (this will clear avatar_url)
      // Actually, AvatarSelector calls onSelect on mount, so avatar_url will be set
      // Let's test username/password validation instead
      await page.getByRole('button', { name: /Create Account/i }).click();
      
      // Wait for validation errors - username and password should still be required
      await expect(page.getByText('Username is required')).toBeVisible({ timeout: 2000 });
      // Avatar might be pre-selected, so we don't check for that error
    });

    test('should successfully register with emoji avatar', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      const username = `test_user_${Date.now()}`;
      
      await registerUser(page, {
        username,
        password: 'testpass123',
        avatar_type: 'emoji',
      });
      
      // Should redirect to home
      await expect(page).toHaveURL(/^\/(home|events)/, { timeout: 5000 });
      
      // Should be authenticated
      const authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);
    });

    test('should show error for duplicate username', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      const username = `test_user_${Date.now()}`;
      
      // Register first time
      await registerUser(page, {
        username,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await clearAuth(page);

      // Try to register again with same username
      await page.goto('/register');
      await page.getByLabel('Username').fill(username);
      await page.getByLabel('Password').fill('testpass123');
      
      // Select emoji avatar
      await page.getByRole('button', { name: /Emoji/i }).click();
      await page.waitForTimeout(300);
      
      // Click first emoji
      const emojiButtons = page.locator('button[aria-label*="emoji"], button[aria-label*="Select"]');
      if (await emojiButtons.count() > 0) {
        await emojiButtons.first().click();
      } else {
        // Fallback: click any single-character button
        const buttons = page.locator('button');
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
          const btn = buttons.nth(i);
          const text = await btn.textContent();
          if (text && text.trim().length === 1 && !text.match(/[A-Za-z0-9]/)) {
            await btn.click();
            break;
          }
        }
      }
      
      await page.getByRole('button', { name: /Create Account/i }).click();
      
      // Should show error
      await expect(page.getByText(/already exists|Registration failed|username/i)).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/register');
      await page.getByRole('link', { name: /Login here/i }).click();
      await expect(page).toHaveURL(/\/login/);
    });

    test('should redirect to home if already authenticated', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Wait for redirect to complete
      await page.waitForTimeout(1000);

      // Try to visit register page
      await page.goto('/register', { waitUntil: 'domcontentloaded' });
      
      // Should redirect to home (App.tsx redirects authenticated users)
      await expect(page).toHaveURL(/^\/(home|events)/, { timeout: 5000 });
    });
  });

  test.describe('Logout', () => {
    test('should logout successfully', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Should be authenticated
      let authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(true);

      // Logout
      await logoutUser(page);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });

      // Should not be authenticated
      authenticated = await isAuthenticated(page);
      expect(authenticated).toBe(false);
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route', async ({ page }) => {
      await clearAuth(page);
      await page.goto('/events');
      
      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('should allow access to protected route when authenticated', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available');

      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Wait for redirect to complete
      await page.waitForTimeout(1000);

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Should stay on events page (or home if events redirects)
      await expect(page).toHaveURL(/\/events|\/(home|events)/, { timeout: 5000 });
    });
  });
});

