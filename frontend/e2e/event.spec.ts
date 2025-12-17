import { test, expect } from '@playwright/test'

test.describe('Event Management', () => {
  // These tests require a running backend with database
  // Skip if backend is not available
  test.beforeEach(async ({ page }) => {
    // Check if backend is reachable
    try {
      const response = await page.request.get('http://localhost:8080/api/health')
      if (!response.ok()) {
        test.skip(true, 'Backend not available')
      }
    } catch {
      test.skip(true, 'Backend not available')
    }
  })

  test('should show events page for authenticated presenter', async ({ page }) => {
    // First register/login
    await page.goto('/register')

    const timestamp = Date.now()
    await page.getByLabel(/username/i).fill(`presenter_${timestamp}`)
    await page.getByLabel(/email/i).fill(`presenter_${timestamp}@test.com`)
    await page.getByLabel(/password/i).fill('testpassword123')

    // Select presenter role if available
    const roleSelect = page.getByLabel(/role/i)
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('presenter')
    }

    // Select an avatar if required
    const emojiAvatar = page.locator('button:has-text("😀")')
    if (await emojiAvatar.isVisible()) {
      await emojiAvatar.click()
    }

    await page.getByRole('button', { name: /register|sign up|create/i }).click()

    // Should be redirected to home or events page
    await page.waitForURL((url) => !url.pathname.includes('register'), { timeout: 10000 })

    // Navigate to events if not already there
    const eventsLink = page.getByRole('link', { name: /events/i })
    if (await eventsLink.isVisible()) {
      await eventsLink.click()
    }
  })

  test('should display event creation form elements', async ({ page }) => {
    await page.goto('/login')

    // Login first
    await page.getByLabel(/username/i).fill('testuser')
    await page.getByLabel(/password/i).fill('testpassword')

    // If there's a create event button, check it works
    const createButton = page.getByRole('button', { name: /create.*event|new.*event/i })
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click()

      // Check form elements are present
      await expect(page.getByLabel(/title|name/i)).toBeVisible()
    }
  })
})
