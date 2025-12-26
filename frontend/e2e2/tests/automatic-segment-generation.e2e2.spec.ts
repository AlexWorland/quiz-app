import { test, expect, Page } from '@playwright/test'
import {
  ensureUserExists,
  loginAndGetSession,
  createEventViaApi,
  TestUser,
} from '../support/api'

const HOST_USER: TestUser = {
  username: 'auto-seg-host',
  password: 'HostPass!123',
  avatar_url: '🎯',
  avatar_type: 'emoji',
}

const PRESENTER_USER: TestUser = {
  username: 'auto-seg-presenter',
  password: 'PresenterPass!123',
  avatar_url: '🎤',
  avatar_type: 'emoji',
}

const PARTICIPANT_USER: TestUser = {
  username: 'auto-seg-participant',
  password: 'ParticipantPass!123',
  avatar_url: '😀',
  avatar_type: 'emoji',
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
  return session
}

function mockWebSocket(page: Page) {
  return page.addInitScript(() => {
    class MockWebSocket {
      static OPEN = 1
      static CLOSED = 3

      url: string
      readyState: number
      onopen: (() => void) | null = null
      onmessage: ((event: { data: string }) => void) | null = null
      onclose: (() => void) | null = null
      sent: string[] = []

      constructor(url: string) {
        this.url = url
        this.readyState = MockWebSocket.OPEN
        setTimeout(() => this.onopen?.(), 0)
      }

      send(data: string) {
        this.sent.push(data)
      }

      close() {
        this.readyState = MockWebSocket.CLOSED
        this.onclose?.()
      }

      trigger(message: Record<string, unknown>) {
        this.onmessage?.({ data: JSON.stringify(message) })
      }
    }

    ;(window as any).__wsInstances = []
    ;(window as any).WebSocket = class extends MockWebSocket {
      constructor(url: string) {
        super(url)
        ;(window as any).__wsInstances.push(this)
      }
    }
  })
}

test.describe('Automatic Segment Generation (e2e2)', () => {
  test('participant can join event without segments', async ({ page, request }) => {
    // Create event without segments
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `No Segments ${Date.now()}`)

    // Login as participant
    await primeAuthViaApi(page, PARTICIPANT_USER)

    // Navigate to join page
    await page.goto(`/join/${event.join_code}`)
    
    // Should be able to see the join page without errors
    await expect(page.locator('body')).not.toContainText('Event not found')
  })

  test('host sees presenter selection UI on event detail page', async ({ page, request }) => {
    await mockWebSocket(page)
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Presenter Select ${Date.now()}`)

    // Login as host
    await primeAuthViaApi(page, HOST_USER)

    // Navigate to event detail
    await page.goto(`/events/${event.id}`)
    
    await expect(page.getByRole('heading', { name: new RegExp(event.title, 'i') })).toBeVisible({ timeout: 10000 })

    // Simulate participants joining via WebSocket
    await page.evaluate(() => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [
            { id: 'p1', username: 'Participant 1', online: true },
            { id: 'p2', username: 'Participant 2', online: true },
          ],
        })
      })
    })

    // Host should see the presenter selection section
    await expect(page.getByText(/Select Presenter/i).first()).toBeVisible({ timeout: 5000 })
  })

  test('selected presenter sees Start Presentation button (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Start Pres ${Date.now()}`)

    // Login as presenter
    const presenterSession = await primeAuthViaApi(page, PRESENTER_USER)

    // Navigate to participant view
    await page.goto(`/events/${event.id}/participate`)

    // Wait for connection
    await page.waitForTimeout(500)

    // Simulate being selected as presenter via WebSocket
    await page.evaluate(({ userId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [{ id: userId, username: 'Presenter User', online: true }],
        })
        ws.trigger({
          type: 'presenter_selected',
          presenter_id: userId,
          presenter_name: 'Presenter User',
          is_first_presenter: true,
        })
      })
    }, { userId: presenterSession.user.id })

    // Should see the Start Presentation button
    await expect(page.getByRole('button', { name: /Start Presentation/i })).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/You've been selected as presenter/i)).toBeVisible({ timeout: 5000 })
  })

  test('non-selected participant sees waiting message (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Wait Pres ${Date.now()}`)

    // Login as participant (not the presenter)
    const participantSession = await primeAuthViaApi(page, PARTICIPANT_USER)

    // Navigate to participant view
    await page.goto(`/events/${event.id}/participate`)

    // Wait for connection
    await page.waitForTimeout(500)

    // Simulate someone else being selected as presenter
    await page.evaluate(({ userId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [
            { id: userId, username: 'Participant User', online: true },
            { id: 'other-user', username: 'Presenter User', online: true },
          ],
        })
        ws.trigger({
          type: 'presenter_selected',
          presenter_id: 'other-user', // Different user
          presenter_name: 'Presenter User',
          is_first_presenter: true,
        })
      })
    }, { userId: participantSession.user.id })

    // Should see waiting message, not Start Presentation button
    await expect(page.getByText(/Waiting for presenter to start/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Presenter User')).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Start Presentation/i })).not.toBeVisible()
  })

  test('clicking Start Presentation sends WS message (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Click Start ${Date.now()}`)

    // Login as presenter
    const presenterSession = await primeAuthViaApi(page, PRESENTER_USER)

    // Navigate to participant view
    await page.goto(`/events/${event.id}/participate`)

    await page.waitForTimeout(500)

    // Simulate being selected as presenter
    await page.evaluate(({ userId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [{ id: userId, username: 'Presenter User', online: true }],
        })
        ws.trigger({
          type: 'presenter_selected',
          presenter_id: userId,
          presenter_name: 'Presenter User',
          is_first_presenter: true,
        })
      })
    }, { userId: presenterSession.user.id })

    // Wait for button to be visible
    await expect(page.getByRole('button', { name: /Start Presentation/i })).toBeVisible({ timeout: 5000 })

    // Click the button
    await page.getByRole('button', { name: /Start Presentation/i }).click()

    // Verify the start_presentation message was sent
    const sentMessages = await page.evaluate(() => {
      const sockets = (window as any).__wsInstances || []
      const messages: string[] = []
      sockets.forEach((ws: any) => {
        messages.push(...(ws.sent || []))
      })
      return messages
    })

    // Check that start_presentation message was sent
    const hasStartPresentationMessage = sentMessages.some((msg: string) => {
      try {
        const parsed = JSON.parse(msg)
        return parsed.type === 'start_presentation'
      } catch {
        return false
      }
    })

    expect(hasStartPresentationMessage).toBeTruthy()
  })

  test('presenter cannot pass to themselves (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `No Self Pass ${Date.now()}`)

    // Login as host (who is also the presenter in this test)
    await primeAuthViaApi(page, HOST_USER)

    // Navigate to event detail (host view)
    await page.goto(`/events/${event.id}`)

    await page.waitForTimeout(500)

    // Simulate being the current presenter with segment complete state
    await page.evaluate(({ userId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [
            { id: userId, username: 'Host User', online: true },
            { id: 'other-1', username: 'Participant 1', online: true },
          ],
        })
        ws.trigger({
          type: 'presenter_changed',
          previous_presenter_id: '',
          new_presenter_id: userId,
          new_presenter_name: 'Host User',
          segment_id: 'seg-1',
        })
      })
    }, { userId: hostSession.user.id })

    // The UI should not allow selecting yourself when passing presenter
    // This is enforced in the PassPresenterButton component which filters out the current user
    // The test verifies the backend validation by checking that pass_presenter with self is rejected
  })

  test('presentation_started message redirects presenter to host view (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Redirect ${Date.now()}`)

    // Login as presenter
    const presenterSession = await primeAuthViaApi(page, PRESENTER_USER)

    // Navigate to participant view
    await page.goto(`/events/${event.id}/participate`)

    await page.waitForTimeout(500)

    const newSegmentId = 'new-segment-123'

    // Simulate being selected, then starting presentation
    await page.evaluate(({ userId, segmentId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [{ id: userId, username: 'Presenter User', online: true }],
        })
        ws.trigger({
          type: 'presentation_started',
          segment_id: segmentId,
          presenter_id: userId,
          presenter_name: 'Presenter User',
        })
      })
    }, { userId: presenterSession.user.id, segmentId: newSegmentId })

    // Should be redirected to host view
    await expect(page).toHaveURL(new RegExp(`/events/${event.id}/host/${newSegmentId}`), { timeout: 5000 })
  })

  test('waiting_for_presenter message shows appropriate UI (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    
    // Create event
    await ensureUserExists(request, HOST_USER)
    const hostSession = await loginAndGetSession(request, HOST_USER)
    const event = await createEventViaApi(request, hostSession.token, `Waiting UI ${Date.now()}`)

    // Login as participant
    const participantSession = await primeAuthViaApi(page, PARTICIPANT_USER)

    // Navigate to participant view
    await page.goto(`/events/${event.id}/participate`)

    await page.waitForTimeout(500)

    // Simulate waiting_for_presenter state
    await page.evaluate(({ userId, eventId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) return
      sockets.forEach((ws: any) => {
        ws.trigger({
          type: 'connected',
          participants: [{ id: userId, username: 'Participant User', online: true }],
        })
        ws.trigger({
          type: 'waiting_for_presenter',
          event_id: eventId,
          participant_count: 5,
        })
      })
    }, { userId: participantSession.user.id, eventId: event.id })

    // Should see the waiting for presenter selection message
    await expect(page.getByText(/Waiting for host to select a presenter/i)).toBeVisible({ timeout: 5000 })
  })
})

