import { APIRequestContext, expect } from '@playwright/test'

export const API_BASE_URL = process.env.E2E2_API_URL || 'http://localhost:8080'

export interface TestUser {
  username: string
  password: string
  avatar_url?: string
  avatar_type?: 'emoji' | 'preset' | 'custom'
}

export interface TestEvent {
  id: string
  title: string
  join_code: string
  mode: string
}

export interface JoinEventResult {
  status: number
  data: any
}

export async function lockEventJoinViaApi(request: APIRequestContext, eventId: string) {
  const response = await request.post(`${API_BASE_URL}/api/events/${eventId}/join/lock`, {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  return { status: response.status(), data }
}

export async function unlockEventJoinViaApi(request: APIRequestContext, eventId: string) {
  const response = await request.post(`${API_BASE_URL}/api/events/${eventId}/join/unlock`, {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  return { status: response.status(), data }
}

export async function ensureUserExists(request: APIRequestContext, user: TestUser) {
  const response = await request.post(`${API_BASE_URL}/api/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: user.username,
      password: user.password,
      avatar_url: user.avatar_url ?? '😀',
      avatar_type: user.avatar_type ?? 'emoji',
    },
  })

  // 201 = created, 409 = already exists (acceptable), otherwise fail
  if (![201, 409].includes(response.status())) {
    const body = await response.text()
    throw new Error(`Failed to ensure user exists: ${response.status()} ${body}`)
  }
}

export async function loginAndGetToken(request: APIRequestContext, user: TestUser): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: user.username,
      password: user.password,
    },
  })
  expect(response.ok(), `Login failed: ${response.status()}`).toBeTruthy()
  const data = await response.json()
  return data.token as string
}

export async function loginAndGetSession(
  request: APIRequestContext,
  user: TestUser
): Promise<{ token: string; user: any }> {
  const response = await request.post(`${API_BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      username: user.username,
      password: user.password,
    },
  })
  expect(response.ok(), `Login failed: ${response.status()}`).toBeTruthy()
  const data = await response.json()
  return { token: data.token, user: data.user }
}

export async function joinEventViaApi(
  request: APIRequestContext,
  joinCode: string,
  displayName: string,
  deviceFingerprint: string,
  avatarUrl = '😀',
  avatarType: 'emoji' | 'preset' | 'custom' = 'emoji'
): Promise<JoinEventResult> {
  const response = await request.post(`${API_BASE_URL}/api/events/join`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      code: joinCode,
      display_name: displayName,
      deviceFingerprint,
      avatar_url: avatarUrl,
      avatar_type: avatarType,
    },
  })

  const data = await response.json().catch(() => ({}))
  return { status: response.status(), data }
}

export async function createEventViaApi(
  request: APIRequestContext,
  token: string,
  title: string
): Promise<TestEvent> {
  const response = await request.post(`${API_BASE_URL}/api/quizzes`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      title,
      description: 'e2e2 user-story event',
      mode: 'listen_only',
      num_fake_answers: 3,
      time_per_question: 30,
    },
  })

  expect([200, 201]).toContain(response.status())
  const data = await response.json()
  return {
    id: data.id,
    title: data.title,
    join_code: data.join_code,
    mode: data.mode,
  }
}

export async function createQuestionViaApi(
  request: APIRequestContext,
  token: string,
  segmentId: string,
  questionText: string,
  correctAnswer: string
): Promise<{ id: string }> {
  const response = await request.post(`${API_BASE_URL}/api/segments/${segmentId}/questions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      question_text: questionText,
      correct_answer: correctAnswer,
    },
  })

  expect([200, 201]).toContain(response.status())
  const data = await response.json()
  return { id: data.id }
}

export async function createSegmentViaApi(
  request: APIRequestContext,
  token: string,
  eventId: string,
  presenterName: string,
  presenterUserId?: string
): Promise<{ id: string; presenter_name: string; presenter_user_id?: string; title?: string }> {
  const response = await request.post(`${API_BASE_URL}/api/quizzes/${eventId}/questions`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    data: {
      presenter_name: presenterName,
      presenter_user_id: presenterUserId,
      title: `${presenterName} Segment`,
    },
  })

  expect([200, 201]).toContain(response.status())
  const data = await response.json()
  return {
    id: data.id,
    presenter_name: data.presenter_name ?? presenterName,
    presenter_user_id: data.presenter_user_id ?? presenterUserId,
    title: data.title,
  }
}

