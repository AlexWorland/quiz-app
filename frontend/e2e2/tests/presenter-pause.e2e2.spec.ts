import { test, expect, Page } from '@playwright/test'
import {
  ensureUserExists,
  loginAndGetSession,
  createEventViaApi,
  createSegmentViaApi,
  createQuestionViaApi,
  TestUser,
} from '../support/api'

const ADMIN_USER: TestUser = {
  username: 'pause-admin',
  password: 'PausePass!123',
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

test.describe('Presenter pause (e2e2)', () => {
  test('host sees pause banner when presenter disconnects (mock WS)', async ({ page, request }) => {
    await mockWebSocket(page)
    await primeAuthViaApi(page, ADMIN_USER)

    const session = await loginAndGetSession(request, ADMIN_USER)
    const event = await createEventViaApi(request, session.token, `Pause ${Date.now()}`)
    const segment = await createSegmentViaApi(request, session.token, event.id, ADMIN_USER.username, session.user.id)
    await createQuestionViaApi(request, session.token, segment.id, 'What is 2+2?', '4')

    await page.goto(`/events/${event.id}/segments/${segment.id}/host`)
    await expect(page.getByRole('heading', { name: new RegExp(`Host: ${event.title}`, 'i') })).toBeVisible({ timeout: 10000 })

    // Drive the mocked WebSocket to simulate an active quiz then presenter pause
    await page.evaluate(({ segmentId }) => {
      const sockets = (window as any).__wsInstances || []
      if (!sockets.length) {
        throw new Error('Mock WebSocket not initialized')
      }
      const messages = [
        { type: 'connected', participants: [] },
        { type: 'game_started' },
        { type: 'phase_changed', phase: 'showing_question', question_index: 0, total_questions: 1 },
        {
          type: 'question',
          question_id: 'q-1',
          question_number: 1,
          total_questions: 1,
          text: 'What is 2+2?',
          answers: ['4'],
          time_limit: 30,
        },
        {
          type: 'presenter_paused',
          presenter_id: 'presenter-1',
          presenter_name: 'Presenter One',
          segment_id: segmentId,
          question_index: 0,
          total_questions: 1,
          reason: 'presenter_disconnected',
        },
        { type: 'phase_changed', phase: 'presenter_paused', question_index: 0, total_questions: 1 },
      ]
      sockets.forEach((ws: any) => messages.forEach((m) => ws.trigger(m)))
    }, { segmentId: segment.id })

    await expect(page.getByText(/Quiz paused/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('The quiz is paused until they return or you assign a new presenter.', { exact: false })).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole('button', { name: /Reveal Answer/i })).toBeHidden({ timeout: 2000 })
  })
})

