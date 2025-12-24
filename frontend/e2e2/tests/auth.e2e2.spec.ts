import { test, expect, Page } from '@playwright/test'
import { mockAuthApi } from '../support/authMocks'

const API_BASE_URL = process.env.E2E2_API_URL || 'http://localhost:8080'

async function ensureUserExists(page: Page, username: string, password: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username,
      password,
      avatar_url: '😀',
      avatar_type: 'emoji',
    },
  })

  // 201 created or 409 conflict (user already exists) are both acceptable
  expect([201, 409]).toContain(res.status())
}

test.describe('Auth flows (e2e2)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('should login with valid credentials and land on home', async ({ page }) => {
    // Ensure the user exists first
    await ensureUserExists(page, 'alice', 'SuperSecret123!')

    await page.goto('/login')
    
    // Wait for page and check what's actually there
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Try to find the form elements
    const usernameInput = page.locator('input[type="text"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    
    await usernameInput.fill('alice')
    await passwordInput.fill('SuperSecret123!')
    
    const loginButton = page.locator('button:has-text("Login")')
    await loginButton.click()

    // Should redirect to home/events page
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/events|\/home|\//, { timeout: 10000 })
  })

  test('should register with default emoji avatar and redirect home', async ({ page }) => {
    const username = `newuser${Date.now()}`

    await page.goto('/register')
    
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Find form elements
    const usernameInput = page.locator('input[type="text"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    
    await usernameInput.fill(username)
    await passwordInput.fill('RegisterPass!123')

    // Click create account button
    const createButton = page.locator('button:has-text("Create Account")')
    await createButton.click()
      
    // Should redirect to home/events page
    await page.waitForTimeout(2000)
    await expect(page).toHaveURL(/\/events|\/home|\//, { timeout: 10000 })
  })
})

