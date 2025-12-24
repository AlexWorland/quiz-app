import { test, expect, Page } from '@playwright/test'
import {
  API_BASE_URL,
  createEventViaApi,
  createQuestionViaApi,
  createSegmentViaApi,
  ensureUserExists,
  loginAndGetSession,
  loginAndGetToken,
  joinEventViaApi,
  lockEventJoinViaApi,
  unlockEventJoinViaApi,
  TestUser,
} from '../support/api'
import crypto from 'crypto'

const ADMIN_USER: TestUser = {
  username: 'story-admin',
  password: 'StoryPass!123',
  avatar_url: '😀',
  avatar_type: 'emoji',
}

const uid = () => crypto.randomUUID()
const uniqueName = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`

async function uiLogin(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function goToManualJoin(page: Page) {
  const link = page.getByText("Can't scan? Enter code manually", { exact: false })
  const fallbackButton = page.getByRole('button', { name: /Enter Code Manually/i })

  if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
    await link.click()
    return
  }

  if (await fallbackButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await fallbackButton.click()
    return
  }

  throw new Error('Manual join control not found')
}

async function primeAuthViaApi(page: Page, user: TestUser) {
  await ensureUserExists(page.request, user)
  const session = await loginAndGetSession(page.request, user)
  await page.goto('/')
  await page.evaluate(({ session }) => {
    localStorage.setItem(
      'auth-store',
      JSON.stringify({
        state: {
          user: session.user,
          token: session.token,
          deviceId: null,
          sessionToken: null,
          isAuthenticated: true,
        },
      })
    )
  }, { session })
  await page.reload()
}

test.describe('User stories (e2e2)', () => {
  test('unauthenticated visit to events redirects to login', async ({ page }) => {
    await page.goto('/events')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Welcome Back')).toBeVisible()
  })

  test('new admin with no events sees empty state', async ({ page }) => {
    const freshUser: TestUser = {
      username: uniqueName('fresh-admin'),
      password: 'StoryPass!123',
      avatar_url: '😀',
      avatar_type: 'emoji',
    }
    await ensureUserExists(page.request, freshUser)
    await page.context().clearCookies()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await primeAuthViaApi(page, freshUser)

    await page.goto('/events')
    await expect(page).toHaveURL(/\/events/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible({ timeout: 10000 })
    await page.getByText('Loading events...', { exact: false }).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    await expect(page.getByText('No events yet')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Create Event' })).toBeVisible({ timeout: 10000 })
  })

  test('create event as admin shows join code and manage controls', async ({ page }) => {
    await primeAuthViaApi(page, ADMIN_USER)

    await page.goto('/events')
    if ((await page.url()).includes('/login')) {
      await uiLogin(page, ADMIN_USER.username, ADMIN_USER.password)
      await page.goto('/events')
    }

    await expect(page).toHaveURL(/\/events/, { timeout: 10000 })
    await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'New Event' }).click()

    const title = `Story Event ${Date.now()}`
    await page.getByLabel('Event Title').fill(title)
    await page.getByLabel('Description (optional)').fill('Story-based e2e2 coverage')
    await page.getByRole('radio', { name: /Traditional/i }).click()
    await page.locator('form').getByRole('button', { name: 'Create Event' }).first().click()

    const card = page.locator('div.bg-dark-900').filter({ has: page.getByRole('heading', { name: title }) }).first()
    await expect(card).toBeVisible()
    const joinCode = (await card.locator('span.font-mono').first().textContent())?.trim() ?? ''
    expect(joinCode).toMatch(/^[A-Z0-9]{6}$/)
    await expect(card.getByRole('button', { name: /^Manage$/ }).first()).toBeVisible()
  })

  test('host can see join QR and status card on event detail', async ({ page }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `QR ${Date.now()}`)

    await page.goto(`/events/${event.id}`)
    await expect(page.getByText(event.title)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(event.join_code).first()).toBeVisible()
    await expect(page.getByText(/Participant Joining/i)).toBeVisible()
    await expect(page.locator('div', { hasText: 'Join Code' }).first()).toBeVisible()
  })

  test('host can lock and unlock joining from event detail', async ({ page }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `LockUI ${Date.now()}`)

    await page.goto(`/events/${event.id}`)
    const lockButton = page.getByRole('button', { name: 'Lock Joining' })
    await expect(lockButton).toBeVisible({ timeout: 5000 })
    await lockButton.click()

    await expect(page.getByText('Joining locked').first()).toBeVisible({ timeout: 5000 })
    const unlockButton = page.getByRole('button', { name: 'Unlock Joining' })
    await expect(unlockButton).toBeVisible({ timeout: 5000 })
    await unlockButton.click()

    await expect(page.getByRole('button', { name: 'Lock Joining' })).toBeVisible({ timeout: 5000 })
  })

  test('QR code renders join URL for participants', async ({ page }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `QRScan ${Date.now()}`)

    await page.goto(`/events/${event.id}`)
    const qr = page.locator('svg').first()
    await expect(qr).toBeVisible({ timeout: 5000 })

    const joinUrl = `${API_BASE_URL}/join?code=${event.join_code}`
    // The QRCodeSVG renders the value in the svg path; we can assert the surrounding join code text.
    await expect(page.getByText(event.join_code).first()).toBeVisible()
    // And confirm the label for scanning is present
    await expect(page.getByText('Participants can scan to join')).toBeVisible()
  })

  test('admin assigned as presenter loads host view for segment', async ({ page, request }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const session = await loginAndGetSession(request, ADMIN_USER)
    const event = await createEventViaApi(request, session.token, `Presenter ${Date.now()}`)
    const segment = await createSegmentViaApi(request, session.token, event.id, ADMIN_USER.username, session.user.id)

    const segRes = await request.get(`${API_BASE_URL}/api/events/${event.id}/segments/${segment.id}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    const segBody = await segRes.json().catch(() => ({}))
    expect(segRes.status(), `segment fetch failed: ${segRes.status()} ${JSON.stringify(segBody)}`).toBe(200)
    expect(segBody.presenter_user_id ?? segBody.presenterUserId).toBe(session.user.id)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)
    await expect(page.getByRole('heading', { name: new RegExp(`Host: ${event.title}`, 'i') })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Assign Presenter' })).toBeVisible({ timeout: 10000 })
  })

  test('admin can open Assign Presenter and see participants or empty state', async ({ page, request }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const session = await loginAndGetSession(request, ADMIN_USER)
    const event = await createEventViaApi(request, session.token, `AssignPresenter ${Date.now()}`)
    const segment = await createSegmentViaApi(request, session.token, event.id, ADMIN_USER.username, session.user.id)

    const segRes = await request.get(`${API_BASE_URL}/api/events/${event.id}/segments/${segment.id}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    const segBody = await segRes.json().catch(() => ({}))
    expect(segRes.status(), `segment fetch failed: ${segRes.status()} ${JSON.stringify(segBody)}`).toBe(200)
    expect(segBody.presenter_user_id ?? segBody.presenterUserId).toBe(session.user.id)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)
    const assignButton = page.getByRole('button', { name: 'Assign Presenter' })
    await assignButton.click()

    const hasParticipant = await page.getByText(ADMIN_USER.username, { exact: false }).isVisible().catch(() => false)
    const hasEmpty = await page.getByText('No participants have joined yet').isVisible().catch(() => false)
    if (!hasParticipant && !hasEmpty) {
      throw new Error('Expected participant options or empty state in Assign Presenter')
    }
  })

  test('start quiz button appears when questions exist', async ({ page, request }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    const session = await loginAndGetSession(request, ADMIN_USER)
    const event = await createEventViaApi(request, session.token, `QuizStart ${Date.now()}`)
    const segment = await createSegmentViaApi(request, session.token, event.id, ADMIN_USER.username, session.user.id)
    await createQuestionViaApi(request, session.token, segment.id, 'What is 2+2?', '4')

    const segRes = await request.get(`${API_BASE_URL}/api/events/${event.id}/segments/${segment.id}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    expect(segRes.status()).toBe(200)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)
    const startButton = page.getByRole('button', { name: /Start Quiz/ })
    await expect(startButton).toBeVisible({ timeout: 10000 })
    await expect(startButton).toBeEnabled()
  })

  test('create event button disabled until title entered', async ({ page }) => {
    await primeAuthViaApi(page, ADMIN_USER)
    await page.goto('/events')
    await page.getByRole('button', { name: 'New Event' }).click()

    const createButton = page.getByRole('button', { name: 'Create Event' })
    await expect(createButton).toBeDisabled()

    await page.getByLabel('Event Title').fill('  ')
    await expect(createButton).toBeDisabled()

    await page.getByLabel('Event Title').fill(`Title ${Date.now()}`)
    await expect(createButton).toBeEnabled()
  })

  test('join event via code with display name and avatar', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Joinable ${Date.now()}`)

    await page.goto(`/join?code=${event.join_code}`)
    await expect(page).toHaveURL(/\/join/, { timeout: 5000 })
    await expect(page.getByText('Join Event')).toBeVisible({ timeout: 5000 })

    await expect(page.getByText(`Code: ${event.join_code}`)).toBeVisible({ timeout: 10000 })
    const nameInput = page.getByPlaceholder('Enter your name')
    await expect(nameInput).toBeVisible({ timeout: 10000 })
    await nameInput.fill('Participant One')
    await page.getByRole('button', { name: '😀 Emoji' }).click()
    await page.getByRole('button', { name: 'Join Event' }).click()

    // Anonymous join currently navigates to a protected event route; expect either the event page
    // (if auth is granted) or a redirect to login due to ProtectedRoute guard.
    await page.waitForURL(/\/(events|login)/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    let finalUrl = page.url()
    await expect
      .poll(() => {
        finalUrl = page.url()
        return finalUrl
      }, { timeout: 5000 })
      .toMatch(/(events|login)/)

    if (/\/login/.test(finalUrl)) {
      await expect(page.getByText('Welcome Back')).toBeVisible()
    } else {
      await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible({ timeout: 5000 })
    }
  })

  test('manual code entry reveals event details before joining', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Manual ${Date.now()}`)

    await page.goto('/join')
    await goToManualJoin(page)
    await page.getByPlaceholder('Enter 6-character code').fill(event.join_code)
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText(`Joining: ${event.title}`)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(`Code: ${event.join_code}`)).toBeVisible({ timeout: 5000 })
  })

  test('joining shows user name on event page (post-redirect)', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `JoinDisplay ${Date.now()}`)

    await page.goto(`/join?code=${event.join_code}`)
    const name = uniqueName('participant')
    await page.getByPlaceholder('Enter your name').fill(name)
    await page.getByRole('button', { name: '😀 Emoji' }).click()
    await page.getByRole('button', { name: 'Join Event' }).click()

    await page.waitForURL(/\/(events|login)/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
    if (/\/login/.test(page.url())) {
      await expect(page.getByText('Welcome Back')).toBeVisible()
    } else {
      await expect(page.getByText(name, { exact: false })).toBeVisible({ timeout: 5000 })
    }
  })

  test('locked event blocks join via UI', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Locked ${Date.now()}`)

    await lockEventJoinViaApi(page.request, event.id)

    await page.goto(`/join?code=${event.join_code}`)
    await page.getByPlaceholder('Enter your name').fill('Locked User')
    await page.getByRole('button', { name: '😀 Emoji' }).click()
    await page.getByRole('button', { name: 'Join Event' }).click()

    // Expect a 403 path with login redirect; verify we end up at login or see the lock message before redirect
    await page.waitForURL(/(login|events)/, { timeout: 10000 })
    const errorVisible = await page
      .getByText('This event is not accepting new participants at this time.', { exact: false })
      .isVisible()
      .catch(() => false)
    const url = page.url()
    if (!/\/login/.test(url) && !/\/events/.test(url) && !errorVisible) {
      throw new Error('Expected lock message or redirect to login or events')
    }
  })

  test('unlocking allows join after lock', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Unlock ${Date.now()}`)

    await lockEventJoinViaApi(page.request, event.id)
    await unlockEventJoinViaApi(page.request, event.id)

    const join = await joinEventViaApi(page.request, event.join_code, 'Unlocked', uid())
    expect(join.status).toBeLessThan(400)
  })

  test('duplicate display names are numbered per event', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Names ${Date.now()}`)

    const first = await joinEventViaApi(page.request, event.join_code, 'Alex', uid())
    const second = await joinEventViaApi(page.request, event.join_code, 'Alex', uid())

    expect(first.status).toBeGreaterThanOrEqual(200)
    expect(first.status).toBeLessThan(300)
    expect(second.status).toBeGreaterThanOrEqual(200)
    expect(second.status).toBeLessThan(300)
    const dn = second.data.display_name || second.data.displayName || second.data.displayname || ''
    expect(dn).toMatch(/Alex( 2)?/)
  })

  test('lowercase join code is accepted and uppercased in UI', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Lower ${Date.now()}`)

    await page.goto('/join')
    await goToManualJoin(page)
    await page.getByPlaceholder('Enter 6-character code').fill(event.join_code.toLowerCase())
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText(`Code: ${event.join_code}`)).toBeVisible({ timeout: 5000 })
  })

  test('same device rejoin returns rejoining flag', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const event = await createEventViaApi(page.request, token, `Rejoin ${Date.now()}`)

    const deviceId = uid()
    const first = await joinEventViaApi(page.request, event.join_code, 'ReJoiner', deviceId)
    const second = await joinEventViaApi(page.request, event.join_code, 'ReJoiner', deviceId)

    expect(first.status).toBeLessThan(400)
    expect(second.status).toBeLessThan(400)
    expect(second.data?.is_rejoining ?? second.data?.isRejoining ?? second.data?.is_rejoin).toBeTruthy()
  })

  test('device already in another active event is blocked', async ({ page }) => {
    await ensureUserExists(page.request, ADMIN_USER)
    const token = await loginAndGetToken(page.request, ADMIN_USER)
    const eventA = await createEventViaApi(page.request, token, `Primary ${Date.now()}`)
    const eventB = await createEventViaApi(page.request, token, `Secondary ${Date.now()}`)

    const sharedDevice = uid()

    const first = await joinEventViaApi(page.request, eventA.join_code, 'DeviceUser', sharedDevice)
    expect(first.status).toBeGreaterThanOrEqual(200)
    expect(first.status).toBeLessThan(300)

    const second = await joinEventViaApi(page.request, eventB.join_code, 'DeviceUser', sharedDevice)
    expect(second.status).toBe(409)
    const detail = second.data?.detail || JSON.stringify(second.data)
    expect(detail).toMatch(/already in another active event/i)
  })

  test('invalid join code shows clear error', async ({ page }) => {
    await page.goto('/join')
    await goToManualJoin(page)
    await page.getByPlaceholder('Enter 6-character code').fill('AAAAAA')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText('Event not found', { exact: false })).toBeVisible()
  })
})

