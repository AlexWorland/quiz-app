import { Page } from '@playwright/test'

export interface AuthMockUser {
  id: string
  username: string
  role: 'presenter' | 'participant'
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
}

const DEFAULT_USER: AuthMockUser = {
  id: 'user-e2e2',
  username: 'e2e2-user',
  role: 'presenter',
  avatar_url: '😀',
  avatar_type: 'emoji',
}

const USE_REAL_API = process.env.E2E2_USE_REAL_API === 'true'

export async function mockAuthApi(page: Page, userOverrides?: Partial<AuthMockUser>) {
  if (USE_REAL_API) {
    return
  }

  const user: AuthMockUser = { ...DEFAULT_USER, ...userOverrides }
  const token = 'e2e2-fake-token'
  const jsonHeaders = { 'Content-Type': 'application/json' }

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ token, user }),
    })
  })

  await page.route('**/api/auth/register', async (route) => {
    await route.fulfill({
      status: 201,
      headers: jsonHeaders,
      body: JSON.stringify({ token, user }),
    })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify(user),
    })
  })
}

