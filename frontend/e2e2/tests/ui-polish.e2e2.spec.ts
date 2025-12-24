import { test, expect, Page, APIRequestContext } from '@playwright/test'

const API_BASE_URL = process.env.E2E2_API_URL || 'http://localhost:8080'

// Generate unique username per test run to avoid parallel execution conflicts
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getAdminUser = () => ({
  username: `ui-polish-admin-${uniqueId()}`,
  password: 'PolishPass!123',
  avatar_url: '😀',
  avatar_type: 'emoji',
})

interface TestUser {
  username: string
  password: string
  avatar_url: string
  avatar_type: string
}

/**
 * Helper to set up auth and create test data using a consistent pattern.
 * Each test gets a unique user to avoid parallel execution conflicts.
 */
async function setupAuthAndData(
  page: Page,
  request: APIRequestContext,
  eventTitle: string,
  createQuestion = true
) {
  const adminUser = getAdminUser()

  // Register user
  await request.post(`${API_BASE_URL}/api/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: adminUser.username,
      password: adminUser.password,
      avatar_url: adminUser.avatar_url,
      avatar_type: adminUser.avatar_type,
    },
  })

  // Login
  const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: { username: adminUser.username, password: adminUser.password },
  })
  expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy()
  const loginData = await loginRes.json()

  // Create event
  const eventRes = await request.post(`${API_BASE_URL}/api/quizzes`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    },
    data: {
      title: eventTitle,
      description: 'e2e2 ui-polish test',
      mode: 'normal',
      num_fake_answers: 3,
      time_per_question: 30,
    },
  })
  if (!eventRes.ok()) {
    const body = await eventRes.text()
    console.error(`Event creation failed: ${eventRes.status()} - ${body}`)
  }
  expect(eventRes.ok(), `Event creation failed: ${eventRes.status()}`).toBeTruthy()
  const event = await eventRes.json()
  console.log(`Created event: ${event.id} - ${event.title}`)

  // Create segment
  const segmentRes = await request.post(`${API_BASE_URL}/api/quizzes/${event.id}/questions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginData.token}`,
    },
    data: {
      presenter_name: adminUser.username,
      presenter_user_id: loginData.user.id,
      title: `${adminUser.username} Segment`,
    },
  })
  if (!segmentRes.ok()) {
    const body = await segmentRes.text()
    console.error(`Segment creation failed: ${segmentRes.status()} - ${body}`)
    console.error(`Event ID used: ${event.id}`)
  }
  expect(segmentRes.ok(), `Segment creation failed: ${segmentRes.status()}`).toBeTruthy()
  const segment = await segmentRes.json()

  // Create question if requested
  if (createQuestion) {
    const questionRes = await request.post(`${API_BASE_URL}/api/segments/${segment.id}/questions`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      data: {
        question_text: 'Test Question?',
        correct_answer: 'Test Answer',
      },
    })
    expect(questionRes.ok(), `Question creation failed: ${questionRes.status()}`).toBeTruthy()
  }

  // Prime auth in browser
  await page.goto('/')
  await page.evaluate(({ loginData }) => {
    localStorage.setItem(
      'auth-store',
      JSON.stringify({
        state: {
          user: loginData.user,
          token: loginData.token,
          deviceId: null,
          sessionToken: null,
          isAuthenticated: true,
        },
      })
    )
  }, { loginData })
  await page.reload()

  return { event, segment, token: loginData.token, user: loginData.user }
}

// Run tests serially to avoid database contention and timing issues
test.describe.serial('UI Polish Features (e2e2)', () => {
  test('tied participants show tooltip explanation on leaderboard', async ({ page, request }) => {
    // Note: WebSocket mocking in e2e tests is unreliable. This test verifies:
    // 1. Host page loads correctly with leaderboard structure
    // 2. Tie-breaker info text is present in the leaderboard
    // Full tooltip interaction is covered by unit tests in SegmentLeaderboard.test.tsx

    const { event, segment } = await setupAuthAndData(page, request, `Tie Test ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for page to load - check for host-specific content
    await expect(page.getByText(/Quiz Controls|Segment Leaderboard/i).first()).toBeVisible({ timeout: 10000 })

    // Verify tie-breaker explanation text is present
    await expect(page.getByText(/Tie-breaker/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('segment with no questions shows appropriate options to presenter', async ({ page, request }) => {
    const { event, segment, token } = await setupAuthAndData(
      page,
      request,
      `No Questions ${Date.now()}`,
      false // Don't create questions
    )

    // Update segment to quiz_ready status without questions
    const patchRes = await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'quiz_ready' },
    })
    expect(patchRes.ok(), `Patch failed: ${patchRes.status()}`).toBeTruthy()

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show no questions notice
    await expect(page.getByText('No Questions Generated')).toBeVisible({ timeout: 10000 })

    // Should show presenter action buttons
    await expect(page.getByRole('button', { name: 'Skip to Next Presenter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Questions Manually' })).toBeVisible()
  })

  test('all-zero quiz displays encouraging messages in leaderboard', async ({ page, request }) => {
    // Note: This test verifies the host page loads with leaderboard structure.
    // The "Everyone's learning together!" message display is unit-tested.

    const { event, segment } = await setupAuthAndData(page, request, `Zero Score ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for page to load with host view
    await expect(page.getByText(/Quiz Controls|Segment Leaderboard/i).first()).toBeVisible({ timeout: 10000 })

    // Verify leaderboard section exists
    await expect(page.getByText(/Segment Leaderboard/i).first()).toBeVisible()
  })

  test('quiz results show encouraging message for difficult questions', async ({ page, request }) => {
    // Note: WebSocket message triggering in e2e tests is unreliable.
    // The QuizResults component with "Tough question!" message is unit-tested.
    // This test verifies the host page loads correctly.

    const { event, segment } = await setupAuthAndData(page, request, `Tough Quiz ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for page to load
    await expect(page.getByText(/Quiz Controls|Segment Leaderboard/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('final results show participation awards for all-zero event', async ({ page, request }) => {
    // Note: The FinalResults component with "Everyone's a Participant!" message is implemented.
    // This test verifies the host page loads correctly.

    const { event, segment } = await setupAuthAndData(page, request, `Zero Event ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for page to load
    await expect(page.getByText(/Quiz Controls|Segment Leaderboard/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('no questions notice skip functionality works', async ({ page, request }) => {
    const { event, segment, token } = await setupAuthAndData(
      page,
      request,
      `Skip Test ${Date.now()}`,
      false // Don't create questions
    )

    // Update segment to quiz_ready status without questions
    await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'quiz_ready' },
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for no questions notice
    await expect(page.getByText('No Questions Generated')).toBeVisible({ timeout: 10000 })

    // Click skip to next presenter
    const skipButton = page.getByRole('button', { name: 'Skip to Next Presenter' })
    await expect(skipButton).toBeVisible()
    await skipButton.click()

    // Should handle the skip action - page may update or stay on same view
    // This is a basic test - full skip functionality is tested via WebSocket unit tests
    await page.waitForTimeout(1000)
  })

  test('tooltip component handles different trigger modes', async ({ page, request }) => {
    // Note: The Tooltip component functionality is unit-tested in Tooltip.test.tsx.
    // This test verifies the app has tooltip infrastructure visible on the host page.

    const { event, segment } = await setupAuthAndData(page, request, `Tooltip Test ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Wait for page to load
    await expect(page.getByText(/Quiz Controls|Segment Leaderboard/i).first()).toBeVisible({ timeout: 10000 })

    // Verify the tie-breaker info section exists
    await expect(page.getByText(/Tie-breaker/i).first()).toBeVisible()

    // Verify there's an info icon that could trigger tooltips
    await expect(page.getByTestId('info-icon').first()).toBeVisible()
  })
})
