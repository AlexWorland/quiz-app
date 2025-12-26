import type { Page } from '@playwright/test';

/**
 * API helper fixtures for E2E tests
 * Provides helpers for API interactions and backend state
 *
 * Note: VITE_API_URL should be just the base URL (e.g., http://localhost:8080)
 * We append /api here for direct API calls
 */

const BASE_URL = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8080';
const API_BASE_URL = `${BASE_URL}/api`;
const USE_MOCKS = process.env.E2E_USE_MOCKS === '1';
const FORCE_BACKEND_UP = process.env.E2E_MODE === 'docker' || process.env.DOCKER_ENV === 'true';

type MockEvent = { id: string; join_code: string; title: string; mode?: string };
type MockSegment = { id: string; event_id: string; presenter_name: string; title?: string };
type MockQuestion = { id: string; segment_id: string; question_text: string };

const mockDb: {
  events: Map<string, MockEvent>;
  segments: Map<string, MockSegment>;
  questions: Map<string, MockQuestion[]>;
  locks: Set<string>;
} = {
  events: new Map(),
  segments: new Map(),
  questions: new Map(),
  locks: new Set(),
};

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function randomJoinCode(): string {
  return `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, '0');
}

async function mockApiRequest(method: string, endpoint: string, data?: any): Promise<any> {
  const cleanEndpoint = endpoint.replace(/^\/api/, '');

  if (cleanEndpoint === '/health') {
    return { status: 'ok' };
  }

  if (method === 'GET' && cleanEndpoint === '/auth/me') {
    const error: any = new Error('Unauthorized');
    error.status = 401;
    throw error;
  }

  if (method === 'POST' && cleanEndpoint === '/auth/logout') {
    return { ok: true };
  }

  if (method === 'POST' && cleanEndpoint === '/auth/register') {
    return { ...data, id: randomId('user') };
  }

  if (method === 'POST' && cleanEndpoint === '/auth/login') {
    return { token: 'mock-token', user: { username: data?.username ?? 'mock' } };
  }

  if (method === 'POST' && cleanEndpoint === '/quizzes') {
    const id = randomId('evt');
    const event: MockEvent = {
      id,
      join_code: randomJoinCode(),
      title: data?.title || 'Mock Event',
      mode: data?.mode ?? 'listen_only',
    };
    mockDb.events.set(id, event);
    return event;
  }

  if (method === 'GET' && cleanEndpoint.startsWith('/quizzes/')) {
    const [, , eventId] = cleanEndpoint.split('/');
    const event = mockDb.events.get(eventId);
    if (!event) throw new Error('Event not found');
    const segments = Array.from(mockDb.segments.values()).filter((seg) => seg.event_id === eventId);
    return { ...event, segments };
  }

  if (method === 'DELETE' && cleanEndpoint.startsWith('/quizzes/')) {
    const [, , eventId] = cleanEndpoint.split('/');
    mockDb.events.delete(eventId);
    mockDb.segments.forEach((seg, id) => {
      if (seg.event_id === eventId) {
        mockDb.segments.delete(id);
      }
    });
    return { ok: true };
  }

  if (method === 'POST' && cleanEndpoint.match(/^\/quizzes\/[^/]+\/(segments|questions)$/)) {
    const [, , eventId] = cleanEndpoint.split('/');
    const segmentId = randomId('seg');
    const segment: MockSegment = {
      id: segmentId,
      event_id: eventId,
      presenter_name: data?.presenter_name ?? 'Presenter',
      title: data?.title ?? 'Segment',
    };
    mockDb.segments.set(segmentId, segment);
    return segment;
  }

  if (method === 'POST' && cleanEndpoint.startsWith('/segments/') && cleanEndpoint.endsWith('/questions')) {
    const [, , segmentId] = cleanEndpoint.split('/');
    const question: MockQuestion = {
      id: randomId('q'),
      segment_id: segmentId,
      question_text: data?.question_text ?? 'Mock Question?',
    };
    const list = mockDb.questions.get(segmentId) || [];
    list.push(question);
    mockDb.questions.set(segmentId, list);
    return question;
  }

  if (method === 'GET' && cleanEndpoint.startsWith('/events/join/')) {
    const joinCode = cleanEndpoint.split('/').pop();
    const event = Array.from(mockDb.events.values()).find((evt) => evt.join_code === joinCode);
    if (!event) {
      const error: any = new Error('Join code not found');
      error.status = 404;
      throw error;
    }
    return event;
  }

  if (method === 'POST' && cleanEndpoint.endsWith('/lock')) {
    const eventId = cleanEndpoint.split('/')[2];
    mockDb.locks.add(eventId);
    return { locked: true };
  }

  if (method === 'POST' && cleanEndpoint.endsWith('/unlock')) {
    const eventId = cleanEndpoint.split('/')[2];
    mockDb.locks.delete(eventId);
    return { locked: false };
  }

  throw new Error(`Mock API route not implemented: ${method} ${endpoint}`);
}

export const useMocks = USE_MOCKS;

export async function handleMockApi(method: string, endpoint: string, data?: any): Promise<any> {
  return mockApiRequest(method, endpoint, data);
}

/**
 * Make API request from test context
 */
export async function apiRequest(
  page: Page,
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
  if (USE_MOCKS) {
    return mockApiRequest(method, endpoint, data);
  }

  const token = await page.evaluate(() => {
    const authStore = localStorage.getItem('auth-store');
    if (!authStore) return null;
    try {
      const parsed = JSON.parse(authStore);
      return parsed.state?.token;
    } catch {
      return null;
    }
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await page.request.fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    data: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Create a test event via API
 */
export async function createEvent(
  page: Page,
  eventData: { title: string; description?: string; mode?: 'listen_only' | 'normal' }
): Promise<{ id: string; join_code: string; title: string }> {
  return await apiRequest(page, 'POST', '/quizzes', eventData);
}

/**
 * Create a segment for an event via API
 */
export async function createSegment(
  page: Page,
  eventId: string,
  segmentData: { presenter_name: string; title?: string; presenter_user_id?: string }
): Promise<{ id: string; event_id: string; presenter_name: string; title?: string }> {
  try {
    return await apiRequest(page, 'POST', `/quizzes/${eventId}/segments`, segmentData);
  } catch {
    return await apiRequest(page, 'POST', `/quizzes/${eventId}/questions`, segmentData);
  }
}

/**
 * Get event by ID
 */
export async function getEvent(page: Page, eventId: string): Promise<any> {
  return await apiRequest(page, 'GET', `/quizzes/${eventId}`);
}

/**
 * Get event by join code
 */
export async function getEventByJoinCode(page: Page, joinCode: string): Promise<any> {
  return await apiRequest(page, 'GET', `/events/join/${joinCode}`);
}

/**
 * Delete event
 */
export async function deleteEvent(page: Page, eventId: string): Promise<void> {
  await apiRequest(page, 'DELETE', `/quizzes/${eventId}`);
}

/**
 * Check if backend is available
 * Checks the health endpoint to verify backend is reachable
 */
export async function isBackendAvailable(page: Page): Promise<boolean> {
  if (USE_MOCKS) {
    return true;
  }
  if (FORCE_BACKEND_UP) {
    return true;
  }

  try {
    const healthCandidates = [
      `${BASE_URL}/api/health`,
      `${BASE_URL}/health`,
    ];

    for (const url of healthCandidates) {
      try {
        const response = await page.request.fetch(url, {
          method: 'GET',
          timeout: 4000,
        });
        if (response.ok || response.status < 500) {
          return true;
        }
      } catch (e: any) {
        if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed') || e.message?.includes('net::ERR')) {
          continue;
        }
      }
    }

    // Fallback: try auth endpoint (will return 401 if backend is up)
    const authUrl = `${BASE_URL}/api/auth/me`;
    try {
      const response = await page.request.fetch(authUrl, {
        method: 'GET',
        timeout: 2000,
      });
      return true;
    } catch (e: any) {
      if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

