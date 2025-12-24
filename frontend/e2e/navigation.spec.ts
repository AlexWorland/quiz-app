import { test, expect } from '@playwright/test';
import { loginUser, registerUser, clearAuth } from './fixtures/auth';
import { isBackendAvailable } from './fixtures/api';
import { registerLogging } from './fixtures/reporting';

registerLogging();

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Welcome Back')).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByText('Join Quiz App')).toBeVisible();
  });

  test('should navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /Register here/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('should navigate from register to login', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: /Login here/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/events');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should redirect to login when accessing home', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should navigate to events page when authenticated', async ({ page }) => {
    await registerUser(page, {
      username: `test_user_${Date.now()}`,
      password: 'testpass123',
      avatar_type: 'emoji',
    });

    await page.waitForTimeout(1000);
    await page.goto('/events', { waitUntil: 'domcontentloaded' });
    // Should be on events page or home (if events redirects)
    await expect(page).toHaveURL(/\/events|\/(home|events)/, { timeout: 5000 });
  });

  test('should handle 404 for unknown routes', async ({ page }) => {
    await page.goto('/unknown-route-12345', { waitUntil: 'domcontentloaded' });
    // App.tsx redirects unknown routes to "/" which requires auth, so should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('should navigate using browser back button', async ({ page }) => {
    await page.goto('/login');
    await page.goto('/register');
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should navigate using browser forward button', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    
    // Go back
    await page.goBack();
    await page.waitForURL(/\/login/, { timeout: 5000 });
    
    // Go forward - check if there's forward history first
    const canGoForward = await page.evaluate(() => window.history.length > 1);
    if (canGoForward) {
      await page.goForward();
      await page.waitForURL(/\/register/, { timeout: 5000 });
      await expect(page).toHaveURL(/\/register/);
    } else {
      // If no forward history, just verify we're still on login
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

