import { test, expect } from '@playwright/test'
import { ensureUserExists, API_BASE_URL, createEventViaApi, createSegmentViaApi, createQuestionViaApi } from '../support/api'

test.describe('Host Join and Manage', () => {
  test('host can join their own event from event detail page', async ({ page, request }) => {
    const hostUser = {
      username: `host-join-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '😀',
      avatar_type: 'emoji' as const,
    }

    // Register and login
    await ensureUserExists(request, hostUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: hostUser.username, password: hostUser.password },
    })
    const loginData = await loginRes.json()

    // Create event
    const event = await createEventViaApi(request, loginData.token, 'Host Join Test')

    // Create segment with question
    const segment = await createSegmentViaApi(
      request,
      loginData.token,
      event.id,
      hostUser.username,
      loginData.user.id
    )

    await createQuestionViaApi(
      request,
      loginData.token,
      segment.id,
      'What is 2+2?',
      '4'
    )

    // Set auth in browser
    await page.goto('http://localhost:5173/')
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
    }, { session: loginData })
    await page.reload()

    // Navigate to event detail page
    await page.goto(`http://localhost:5173/events/${event.id}`)
    await page.waitForLoadState('networkidle')

    // Should see "Join Event" button
    const joinButton = page.getByRole('button', { name: /Join Event/i })
    await expect(joinButton).toBeVisible({ timeout: 10000 })

    // Click join event button
    await joinButton.click()

    // Should see join modal
    await expect(page.getByText('Join Your Event')).toBeVisible()
    await expect(page.locator('input[placeholder*="Quiz Master"]')).toBeVisible()

    // Enter display name
    await page.locator('label:has-text("Display Name")').locator('..').locator('input').fill('Host Player')
    
    // Click join in modal (there are multiple Join Event buttons)
    await page.locator('.bg-dark-900.rounded-lg.p-8').getByRole('button', { name: /Join Event/i }).click()

    // Should navigate to event participant view
    await page.waitForURL(`**/events/${event.id}/**`, { timeout: 10000 })

    // Should see participant UI elements
    await expect(page.getByText('Host Player')).toBeVisible({ timeout: 5000 })
  })

  test('host participating in event sees Manage Event button', async ({ page, request }) => {
    const hostUser = {
      username: `manage-test-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '🎮',
      avatar_type: 'emoji' as const,
    }

    // Setup
    await ensureUserExists(request, hostUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: hostUser.username, password: hostUser.password },
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Manage Test')
    const segment = await createSegmentViaApi(
      request,
      loginData.token,
      event.id,
      hostUser.username,
      loginData.user.id
    )

    // Join as participant
    const joinRes = await request.post(`${API_BASE_URL}/api/events/${event.id}/join-as-host`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
      data: {
        display_name: 'Host Playing',
        avatar_url: '🎮',
        avatar_type: 'emoji',
      },
    })
    const joinData = await joinRes.json()

    // Set auth in browser including participant session
    await page.goto('http://localhost:5173/')
    await page.evaluate(({ session, sessionToken, deviceId }) => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            user: session.user,
            token: session.token,
            deviceId: deviceId,
            sessionToken: sessionToken,
            isAuthenticated: true,
          },
        })
      )
    }, { 
      session: loginData,
      sessionToken: joinData.sessionToken,
      deviceId: joinData.deviceId
    })
    await page.reload()

    // Navigate to participant view
    await page.goto(`http://localhost:5173/events/${event.id}/segments/${segment.id}`)
    await page.waitForLoadState('networkidle')
    
    // Wait for event to load
    await expect(page.getByText('Host Playing')).toBeVisible({ timeout: 10000 })

    // Debug: Check if button exists
    const hasManageButton = await page.locator('button:has-text("Manage Event")').count()
    console.log('Manage Event button count:', hasManageButton)
    
    // Debug: Check user and host IDs
    const debugInfo = await page.evaluate(() => {
      const authStore = localStorage.getItem('auth-store')
      return {
        authStore: authStore ? JSON.parse(authStore) : null,
        bodyText: document.body.textContent?.substring(0, 500)
      }
    })
    console.log('Debug info:', debugInfo)

    // Should see "Manage Event" button (only visible to host)
    const manageButton = page.getByRole('button', { name: /Manage Event/i })
    await expect(manageButton).toBeVisible({ timeout: 10000 })

    // Click manage button
    await manageButton.click()

    // Should navigate to event detail page
    await page.waitForURL(`**/events/${event.id}`, { timeout: 5000 })

    // Should see management UI
    await expect(page.getByText('Presentation Segments')).toBeVisible()
  })

  test('host can switch between manage and participate views while preserving session', async ({ page, request }) => {
    const hostUser = {
      username: `session-test-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '🎯',
      avatar_type: 'emoji' as const,
    }

    // Setup
    await ensureUserExists(request, hostUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: hostUser.username, password: hostUser.password },
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Session Preserve Test')
    const segment = await createSegmentViaApi(
      request,
      loginData.token,
      event.id,
      hostUser.username,
      loginData.user.id
    )

    await createQuestionViaApi(request, loginData.token, segment.id, 'Test question?', 'Answer')

    // Join as participant
    const joinRes = await request.post(`${API_BASE_URL}/api/events/${event.id}/join-as-host`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
      data: {
        display_name: 'Host Player',
      },
    })
    const joinData = await joinRes.json()

    // Set auth
    await page.goto('http://localhost:5173/')
    await page.evaluate(({ session, sessionToken, deviceId }) => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            user: session.user,
            token: session.token,
            deviceId: deviceId,
            sessionToken: sessionToken,
            isAuthenticated: true,
          },
        })
      )
    }, { 
      session: loginData,
      sessionToken: joinData.sessionToken,
      deviceId: joinData.deviceId
    })
    await page.reload()

    // Navigate to participant view
    await page.goto(`http://localhost:5173/events/${event.id}/segments/${segment.id}`)
    await page.waitForLoadState('networkidle')

    // Should be in event as participant
    await expect(page.getByText('Host Player')).toBeVisible({ timeout: 5000 })

    // Click Manage Event
    await page.getByRole('button', { name: /Manage Event/i }).click()
    await page.waitForURL(`**/events/${event.id}`)

    // Navigate back to event
    const firstSegment = page.locator('text=Segment 1').first()
    if (await firstSegment.isVisible({ timeout: 2000 })) {
      await firstSegment.click()
      await page.waitForURL(`**/events/${event.id}/segments/**`)
      
      // Should reconnect and restore session
      // Should still see display name (proves session preserved)
      await expect(page.getByText('Host Player')).toBeVisible({ timeout: 5000 })
    }
  })

  test('join event button is disabled when event is locked', async ({ page, request }) => {
    const hostUser = {
      username: `locked-join-${Date.now()}`,
      password: 'TestPass!123',
    }

    await ensureUserExists(request, hostUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: hostUser.username, password: hostUser.password },
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Locked Event')

    // Lock the event
    await request.post(`${API_BASE_URL}/api/events/${event.id}/join/lock`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    })

    // Set auth
    await page.goto('http://localhost:5173/')
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
    }, { session: loginData })
    await page.reload()

    // Navigate to event detail
    await page.goto(`http://localhost:5173/events/${event.id}`)
    await page.waitForLoadState('networkidle')

    // Join button should be disabled
    const joinButton = page.getByRole('button', { name: /Join Event/i })
    await expect(joinButton).toBeDisabled()
  })
})

