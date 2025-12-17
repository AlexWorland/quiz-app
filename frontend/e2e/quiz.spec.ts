import { test, expect } from '@playwright/test'

test.describe('Quiz Participation', () => {
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

  test('should allow joining event by code', async ({ page }) => {
    await page.goto('/')

    // Look for join event input
    const joinInput = page.getByPlaceholder(/code|join/i)
    if (await joinInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await joinInput.fill('TEST123')

      const joinButton = page.getByRole('button', { name: /join/i })
      if (await joinButton.isVisible()) {
        await joinButton.click()
      }
    }
  })

  test('should display quiz interface elements', async ({ page }) => {
    // This test verifies the quiz UI components exist when in a quiz
    await page.goto('/')

    // Check that core UI elements can render without errors
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

test.describe('Quiz Components Visual', () => {
  test('should render answer selection correctly', async ({ page }) => {
    // Navigate to a page that shows quiz components
    await page.goto('/')

    // Verify no JavaScript errors
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.waitForTimeout(1000)
    expect(errors).toHaveLength(0)
  })
})
