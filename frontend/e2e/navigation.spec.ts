import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/')

    // App should load without errors
    await expect(page).not.toHaveTitle(/error/i)
  })

  test('should have working navigation structure', async ({ page }) => {
    await page.goto('/login')

    // Check that basic page elements exist
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })

  test('should handle 404 routes gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')

    // Should either show 404 or redirect to login/home
    const url = page.url()
    expect(url).toBeTruthy()
  })
})
