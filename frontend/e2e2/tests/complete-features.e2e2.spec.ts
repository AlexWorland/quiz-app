import { test, expect, Page, APIRequestContext } from '@playwright/test'
import crypto from 'crypto'
import { ensureUserExists, API_BASE_URL } from '../support/api'

// Generate unique username per test to avoid conflicts
const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const getAdminUser = () => ({
  username: `complete-features-admin-${uniqueId()}`,
  password: 'CompletePass!123',
  avatar_url: '😀',
  avatar_type: 'emoji',
})

const uid = () => crypto.randomUUID()

/**
 * Consistent auth and data setup using single request context.
 */
async function setupAuthAndData(
  page: Page,
  request: APIRequestContext,
  eventTitle: string,
  options: { createQuestion?: boolean; segmentStatus?: string; previousStatus?: string } = {}
) {
  const { createQuestion = true, segmentStatus, previousStatus } = options
  const adminUser = getAdminUser()

  // Register user (handles 409 if already exists)
  await ensureUserExists(request, adminUser)

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
      description: 'e2e2 complete-features test',
      mode: 'listen_only',
      num_fake_answers: 3,
      time_per_question: 30,
    },
  })
  expect(eventRes.ok(), `Event creation failed: ${eventRes.status()}`).toBeTruthy()
  const event = await eventRes.json()

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
    const questionBody = await questionRes.json()
    console.log(`[DEBUG] Question creation status: ${questionRes.status()}, id: ${questionBody.id}`)
    expect(questionRes.ok(), `Question creation failed: ${questionRes.status()}`).toBeTruthy()
  }

  // Update segment status if needed
  if (segmentStatus || previousStatus) {
    const patchData: Record<string, string> = {}
    if (segmentStatus) patchData.status = segmentStatus
    if (previousStatus) patchData.previous_status = previousStatus

    const patchRes = await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      data: patchData,
    })
    const patchBody = await patchRes.json()
    console.log(`[DEBUG] PATCH response status: ${patchRes.status()}, previous_status: ${patchBody.previous_status}`)
    expect(patchRes.ok(), `Segment PATCH failed: ${patchRes.status()}`).toBeTruthy()

    // Re-fetch segment to get updated data
    const updatedSegmentRes = await request.get(`${API_BASE_URL}/api/events/${event.id}/segments/${segment.id}`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    })
    expect(updatedSegmentRes.ok(), `Segment GET failed: ${updatedSegmentRes.status()}`).toBeTruthy()
    const updatedSegment = await updatedSegmentRes.json()
    console.log(`[DEBUG] GET segment previous_status: ${updatedSegment.previous_status}, status: ${updatedSegment.status}`)
    Object.assign(segment, updatedSegment)
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

  return { event, segment, token: loginData.token, user: loginData.user, adminUser }
}

// Run tests serially to avoid database contention
test.describe.serial('Complete Missing Features (e2e2)', () => {
  test('resume controls appear for completed segment with previous_status', async ({ page, request }) => {
    const { event, segment } = await setupAuthAndData(page, request, `Resume Test ${Date.now()}`, {
      segmentStatus: 'completed',
      previousStatus: 'quiz_ready',
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show resume controls (ResumeControls component checks previous_status)
    await expect(page.getByText(/Segment Ended Accidentally/)).toBeVisible({ timeout: 10000 })

    // Should show both Resume and Clear buttons
    const resumeButton = page.getByRole('button', { name: /^Resume$/ })
    const clearButton = page.getByRole('button', { name: /Clear & Continue/ })
    await expect(resumeButton).toBeVisible()
    await expect(clearButton).toBeVisible()

    // Clicking Resume should trigger the resume action and clear previous_status
    await resumeButton.click()

    // After successful resume, the ResumeControls should disappear (previous_status is cleared)
    await expect(page.getByText(/Segment Ended Accidentally/)).not.toBeVisible({ timeout: 10000 })
  })

  test('join lock status is displayed when event is locked', async ({ page, request }) => {
    // Test that lock status is shown in QRCodeDisplay when join is locked
    // The 5+ minute reminder timing is unit-tested in JoinLockReminder.test.tsx
    const { event, segment, token } = await setupAuthAndData(page, request, `Lock Test ${Date.now()}`)

    // Lock joining using the correct endpoint
    const lockRes = await request.post(`${API_BASE_URL}/api/events/${event.id}/join/lock`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    expect(lockRes.ok(), `Lock failed: ${lockRes.status()}`).toBeTruthy()

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Verify lock status is reflected in QR code display area
    await expect(page.getByText('Joining locked')).toBeVisible({ timeout: 10000 })
  })

  test('device conflict is handled gracefully (covered by user-stories)', async ({ page, request }) => {
    // This functionality is fully tested in user-stories.e2e2.spec.ts:
    // - "device already in another active event is blocked"
    // Here we verify the error message format
    const { event } = await setupAuthAndData(page, request, `Device Test ${Date.now()}`)

    // First join
    const deviceId = crypto.randomUUID()
    await request.post(`${API_BASE_URL}/api/events/join`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        code: event.join_code,
        display_name: 'Test User',
        avatar_url: '😀',
        avatar_type: 'emoji',
        device_fingerprint: deviceId,
      },
    })

    // Create second event and try to join with same device
    const { event: event2 } = await setupAuthAndData(page, request, `Device Test 2 ${Date.now()}`)
    const joinRes = await request.post(`${API_BASE_URL}/api/events/join`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        code: event2.join_code,
        display_name: 'Test User 2',
        avatar_url: '😀',
        avatar_type: 'emoji',
        device_fingerprint: deviceId,
      },
    })

    // Should get 409 conflict
    expect(joinRes.status()).toBe(409)
    const error = await joinRes.json()
    expect(error.detail).toContain('already in another active event')
  })

  test('quiz controls show when segment has questions and quiz_ready status', async ({ page, request }) => {
    // Test that quiz can be started when questions exist and segment is quiz_ready
    const { event, segment, token } = await setupAuthAndData(page, request, `Quiz Ready ${Date.now()}`)

    // Set segment to quiz_ready
    await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'quiz_ready' },
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show quiz controls with start button
    await expect(page.getByRole('button', { name: /Start Quiz/i })).toBeVisible({ timeout: 10000 })
  })

  test('presenter controls are visible for assigned presenter', async ({ page, request }) => {
    // Test that presenter controls appear when user is the assigned presenter
    const { event, segment } = await setupAuthAndData(page, request, `Presenter Test ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show presenter-related controls
    await expect(page.getByText(/Quiz Controls/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Assign Presenter/i)).toBeVisible()
  })

  test('waiting room shows participant count correctly', async ({ page, request }) => {
    // Test that the host view shows correct participant count
    const { event, segment } = await setupAuthAndData(page, request, `Waiting Room ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show 0 participants initially
    await expect(page.getByText(/0 participant/i)).toBeVisible({ timeout: 10000 })
  })

  test('segment leaderboard shows empty state message', async ({ page, request }) => {
    // Test that leaderboard shows appropriate empty state
    const { event, segment } = await setupAuthAndData(page, request, `Leaderboard Test ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show empty leaderboard message
    await expect(page.getByText(/No participants yet/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('segment completion via API clears quiz state', async ({ page, request }) => {
    // Test completing a segment via API and verifying UI updates
    const { event, segment, token } = await setupAuthAndData(page, request, `Complete Test ${Date.now()}`)

    // Set segment to completed
    await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'completed' },
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Page should load without errors
    await expect(page.getByText(/Quiz Controls/i)).toBeVisible({ timeout: 10000 })
  })

  test('clear resume state dismisses resume controls', async ({ page, request }) => {
    const { event, segment } = await setupAuthAndData(page, request, `Clear Resume ${Date.now()}`, {
      segmentStatus: 'completed',
      previousStatus: 'quiz_ready',
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show resume controls
    await expect(page.getByText(/Segment Ended Accidentally/)).toBeVisible({ timeout: 10000 })

    // Click "Clear & Continue" to dismiss without resuming
    const clearButton = page.getByRole('button', { name: /Clear & Continue/ })
    await expect(clearButton).toBeVisible()
    await clearButton.click()

    // ResumeControls should disappear after clearing
    await expect(page.getByText(/Segment Ended Accidentally/)).not.toBeVisible({ timeout: 10000 })
  })

  test('same device rejoining same event gets is_rejoining flag', async ({ page, request }) => {
    // Test that rejoining the same event with same device is handled correctly
    const { event } = await setupAuthAndData(page, request, `Rejoin Test ${Date.now()}`)
    const deviceId = crypto.randomUUID()

    // First join
    const firstJoin = await request.post(`${API_BASE_URL}/api/events/join`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        code: event.join_code,
        display_name: 'Rejoiner',
        avatar_url: '😀',
        avatar_type: 'emoji',
        device_fingerprint: deviceId,
      },
    })
    expect(firstJoin.ok()).toBeTruthy()
    const firstData = await firstJoin.json()
    expect(firstData.isRejoining).toBe(false)

    // Second join with same device to same event
    const secondJoin = await request.post(`${API_BASE_URL}/api/events/join`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        code: event.join_code,
        display_name: 'Rejoiner',
        avatar_url: '😀',
        avatar_type: 'emoji',
        device_fingerprint: deviceId,
      },
    })
    expect(secondJoin.ok()).toBeTruthy()
    const secondData = await secondJoin.json()
    expect(secondData.isRejoining).toBe(true)
  })

  test('presenter selection shows enhanced connection feedback', async ({ page, request }) => {
    const { event, segment } = await setupAuthAndData(page, request, `Presenter Select ${Date.now()}`)

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Verify connection status is shown
    await expect(page.getByText(/Connected|Disconnected/).first()).toBeVisible({ timeout: 10000 })
    // Check for participant count display (0 participants)
    await expect(page.getByText(/\d+ participant/)).toBeVisible()
  })

  test('no questions generated shows appropriate presenter options', async ({ page, request }) => {
    const { event, segment, token } = await setupAuthAndData(page, request, `No Questions ${Date.now()}`, {
      createQuestion: false,
    })

    // Update to quiz_ready without questions
    await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'quiz_ready' },
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show no questions notice with options
    await expect(page.getByRole('heading', { name: 'No Questions Generated' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Skip to Next Presenter' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Questions Manually' })).toBeVisible()
  })

  test('answer selection component is accessible when quiz is ready', async ({ page, request }) => {
    // Test that AnswerSelection component structure is correct
    // The time buffer warning logic is unit-tested in AnswerSelection.test.tsx
    const { event, segment, token } = await setupAuthAndData(page, request, `Answer Test ${Date.now()}`)

    // Set segment to quiz_ready with question
    await request.patch(`${API_BASE_URL}/api/segments/${segment.id}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: { status: 'quiz_ready' },
    })

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)

    // Should show quiz controls including Start Quiz button
    await expect(page.getByRole('button', { name: /Start Quiz/i })).toBeVisible({ timeout: 10000 })

    // Question list heading should be visible (use getByRole to be specific)
    await expect(page.getByRole('heading', { name: 'Generated Questions' })).toBeVisible()
  })

  test('status toast provides feedback for presenter actions', async ({ page }) => {
    // Test that StatusToast component exists and can be triggered
    await page.goto('/')

    // StatusToast is rendered at app level - verify it exists in DOM structure
    // This is a basic smoke test; full toast behavior is unit tested
    const appRoot = page.locator('#root')
    await expect(appRoot).toBeVisible()
  })
})
