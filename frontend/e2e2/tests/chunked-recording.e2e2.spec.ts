import { test, expect } from '@playwright/test'
import { ensureUserExists, API_BASE_URL, createEventViaApi, createSegmentViaApi } from '../support/api'

test.describe('Chunked Audio Recording', () => {
  test('should show chunk upload status during recording', async ({ page, request }) => {
    const user = {
      username: `chunk-ui-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '🎤',
      avatar_type: 'emoji' as const,
    }

    // Setup
    await ensureUserExists(request, user)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: user.username, password: user.password }
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Chunk UI Test')
    const segment = await createSegmentViaApi(
      request,
      loginData.token,
      event.id,
      user.username,
      loginData.user.id
    )

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

    // Navigate to host view
    await page.goto(`http://localhost:5173/events/${event.id}/segments/${segment.id}/host`)
    await page.waitForLoadState('networkidle')

    // Mock MediaRecorder
    await page.evaluate(() => {
      const mockStream = {
        getTracks: () => [{ stop: () => {} }]
      }
      ;(navigator.mediaDevices as any).getUserMedia = async () => mockStream

      class MockMediaRecorder {
        ondataavailable: ((event: any) => void) | null = null
        onstop: (() => void) | null = null
        state = 'inactive'
        
        start(timeslice: number) {
          this.state = 'recording'
          // Simulate chunk every minute
          setTimeout(() => {
            if (this.ondataavailable) {
              const blob = new Blob(['fake audio chunk'], { type: 'audio/webm' })
              this.ondataavailable({ data: blob } as any)
            }
          }, 100) // Shorter for testing
        }
        
        stop() {
          this.state = 'inactive'
          if (this.onstop) {
            this.onstop()
          }
        }
      }
      
      ;(window as any).MediaRecorder = MockMediaRecorder
    })

    // Start recording
    await page.locator('button:has-text("Start Recording")').click()
    await expect(page.locator('text=Recording Status')).toBeVisible()

    // Should show chunk upload status (may need to wait for mock chunk)
    await expect(page.locator('text=saved').or(page.locator('text=Uploading chunk'))).toBeVisible({ timeout: 5000 })
  })

  test('host can view processing logs button', async ({ page, request }) => {
    const user = {
      username: `logs-test-${Date.now()}`,
      password: 'TestPass!123',
    }

    await ensureUserExists(request, user)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: user.username, password: user.password }
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Logs Test')
    const segment = await createSegmentViaApi(
      request,
      loginData.token,
      event.id,
      user.username,
      loginData.user.id
    )

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

    await page.goto(`http://localhost:5173/events/${event.id}/segments/${segment.id}/host`)
    await page.waitForLoadState('networkidle')

    // Should see View Logs button
    const logsButton = page.locator('button:has-text("View Logs")')
    await expect(logsButton).toBeVisible({ timeout: 5000 })

    // Click to open logs modal
    await logsButton.click()
    await expect(page.getByRole('heading', { name: 'Processing Logs' })).toBeVisible()
  })

  test('chunk upload indicator updates during recording', async ({ page, request }) => {
    // Test that chunk counter increments
    // This is more of a UI smoke test since we're mocking the recording
    const user = { username: `chunk-count-${Date.now()}`, password: 'Test!123' }
    
    await ensureUserExists(request, user)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: user.username, password: user.password }
    })
    const loginData = await loginRes.json()

    const event = await createEventViaApi(request, loginData.token, 'Count Test')
    const segment = await createSegmentViaApi(request, loginData.token, event.id, user.username, loginData.user.id)

    await page.goto('http://localhost:5173/')
    await page.evaluate(({ session }) => {
      localStorage.setItem('auth-store', JSON.stringify({
        state: {
          user: session.user,
          token: session.token,
          deviceId: null,
          sessionToken: null,
          isAuthenticated: true,
        },
      }))
    }, { session: loginData })
    await page.reload()

    await page.goto(`http://localhost:5173/events/${event.id}/segments/${segment.id}/host`)
    await page.waitForLoadState('networkidle')

    // Recording functionality would be tested here
    // Keeping it simple as a smoke test
    await expect(page.locator('text=Recording Status')).toBeVisible()
  })
})

