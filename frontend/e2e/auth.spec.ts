import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await expect(page).toHaveURL(/.*login/)
  })

  test('should display login form', async ({ page }) => {
    await page.goto('/login')

    // Check heading contains welcome or login text
    await expect(page.getByRole('heading').first()).toBeVisible()
    // Check form inputs exist by placeholder
    await expect(page.getByPlaceholder(/username/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
    // Check login button
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('should display registration form', async ({ page }) => {
    await page.goto('/register')

    // Check heading exists
    await expect(page.getByRole('heading').first()).toBeVisible()
    // Check form inputs exist by placeholder (no email field in this form)
    await expect(page.getByPlaceholder(/username/i)).toBeVisible()
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible()
    // Check avatar selector is present
    await expect(page.getByText(/choose your avatar/i)).toBeVisible()
  })

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('/login')

    await page.getByPlaceholder(/username/i).fill('invaliduser')
    await page.getByPlaceholder(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /login/i }).click()

    // Should show error message or stay on login page
    await expect(page).toHaveURL(/.*login/)
  })

  test('should navigate between login and register', async ({ page }) => {
    await page.goto('/login')

    // Look for link to register
    const registerLink = page.getByRole('link', { name: /register/i })
    await expect(registerLink).toBeVisible()
    await registerLink.click()
    await expect(page).toHaveURL(/.*register/)
  })
})
