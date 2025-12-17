import { test as base, expect, Page } from '@playwright/test'

// Test user credentials - these should be configured in your test environment
export const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'testpassword123',
}

export const TEST_PRESENTER = {
  username: 'testpresenter',
  email: 'presenter@example.com',
  password: 'testpassword123',
}

// Helper to register a new user
export async function registerUser(page: Page, user: typeof TEST_USER) {
  await page.goto('/register')

  await page.getByPlaceholder(/username/i).fill(user.username)
  await page.getByPlaceholder(/password/i).first().fill(user.password)

  // Select an emoji avatar (required)
  const emojiButton = page.locator('button:has-text("😀")')
  if (await emojiButton.isVisible()) {
    await emojiButton.click()
  }

  await page.getByRole('button', { name: /register|sign up|create/i }).click()

  // Wait for navigation away from register page
  await expect(page).not.toHaveURL(/.*register/)
}

// Helper to login
export async function loginUser(page: Page, user: { username: string; password: string }) {
  await page.goto('/login')

  await page.getByPlaceholder(/username/i).fill(user.username)
  await page.getByPlaceholder(/password/i).fill(user.password)
  await page.getByRole('button', { name: /login/i }).click()

  // Wait for navigation away from login page
  await expect(page).not.toHaveURL(/.*login/, { timeout: 10000 })
}

// Extended test fixture with authentication
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Try to login, if fails try to register first
    try {
      await loginUser(page, TEST_PRESENTER)
    } catch {
      await registerUser(page, TEST_PRESENTER)
      await loginUser(page, TEST_PRESENTER)
    }
    await use(page)
  },
})

export { expect }
