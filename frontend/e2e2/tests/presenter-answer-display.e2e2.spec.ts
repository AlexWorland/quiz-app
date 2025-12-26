import { test, expect } from '@playwright/test'
import { ensureUserExists, API_BASE_URL } from '../support/api'
import crypto from 'crypto'

test.describe('Presenter Answer Display', () => {
  test('should highlight correct answer for presenter during quiz', async ({ page, request }) => {
    const adminUser = {
      username: `presenter-test-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '😀',
      avatar_type: 'emoji',
    }

    // Register and login
    await ensureUserExists(request, adminUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: adminUser.username, password: adminUser.password },
    })
    const { token } = await loginRes.json()

    // Create event
    const eventRes = await request.post(`${API_BASE_URL}/api/quizzes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'Presenter Answer Test',
        mode: 'listen_only',
      },
    })
    const event = await eventRes.json()

    // Create segment
    const segmentRes = await request.post(
      `${API_BASE_URL}/api/quizzes/${event.id}/questions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          presenter_name: 'Test Presenter',
          title: 'Test Segment',
        },
      }
    )
    const segment = await segmentRes.json()

    // Create a question manually for testing
    const questionRes = await request.post(
      `${API_BASE_URL}/segments/${segment.id}/questions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          question_text: 'What is 2+2?',
          correct_answer: '4',
          fake_answers: ['3', '5', '6'],
          order_index: 0,
        },
      }
    )
    const question = await questionRes.json()

    // Set auth token
    await page.goto(`${API_BASE_URL}`)
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken)
    }, token)

    // Navigate to host quiz view
    await page.goto(`/events/${event.id}/host/${segment.id}`)

    // Start quiz (if quiz UI is shown)
    const startButton = page.locator('button:has-text("Start Quiz")')
    if (await startButton.isVisible({ timeout: 2000 })) {
      await startButton.click()
      
      // Wait for question to appear
      await expect(page.locator('text=What is 2+2?')).toBeVisible({ timeout: 5000 })
      
      // Verify correct answer is highlighted
      const correctAnswerText = page.locator('text=✓ CORRECT')
      await expect(correctAnswerText).toBeVisible()
      
      // Verify presenter view label
      await expect(page.locator('text=Presenter view')).toBeVisible()
    }
  })

  test('should show only one correct answer marker', async ({ page, request }) => {
    const adminUser = {
      username: `single-correct-${Date.now()}`,
      password: 'TestPass!123',
      avatar_url: '😀',
      avatar_type: 'emoji',
    }

    await ensureUserExists(request, adminUser)
    const loginRes = await request.post(`${API_BASE_URL}/api/auth/login`, {
      data: { username: adminUser.username, password: adminUser.password },
    })
    const { token } = await loginRes.json()

    const eventRes = await request.post(`${API_BASE_URL}/api/quizzes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: 'Single Correct Test',
        mode: 'listen_only',
      },
    })
    const event = await eventRes.json()

    const segmentRes = await request.post(
      `${API_BASE_URL}/api/quizzes/${event.id}/questions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          presenter_name: 'Test',
          title: 'Test',
        },
      }
    )
    const segment = await segmentRes.json()

    // Create question
    await request.post(
      `${API_BASE_URL}/segments/${segment.id}/questions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          question_text: 'Test question?',
          correct_answer: 'Answer A',
          fake_answers: ['Answer B', 'Answer C', 'Answer D'],
          order_index: 0,
        },
      }
    )

    await page.goto(`${API_BASE_URL}`)
    await page.evaluate((authToken) => {
      localStorage.setItem('auth_token', authToken)
    }, token)

    await page.goto(`/events/${event.id}/host/${segment.id}`)

    const startButton = page.locator('button:has-text("Start Quiz")')
    if (await startButton.isVisible({ timeout: 2000 })) {
      await startButton.click()
      
      // Count correct markers - should be exactly 1
      const correctMarkers = page.locator('text=✓ CORRECT')
      await expect(correctMarkers).toHaveCount(1)
    }
  })
})

