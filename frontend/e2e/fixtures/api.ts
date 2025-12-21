import type { Page } from '@playwright/test';

/**
 * API helper fixtures for E2E tests
 * Provides helpers for API interactions and backend state
 *
 * Note: VITE_API_URL should be just the base URL (e.g., http://localhost:8080)
 * We append /api here for direct API calls
 */

const BASE_URL = process.env.VITE_API_URL || 'http://localhost:8080';
const API_BASE_URL = `${BASE_URL}/api`;

/**
 * Make API request from test context
 */
export async function apiRequest(
  page: Page,
  method: string,
  endpoint: string,
  data?: any
): Promise<any> {
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
  return await apiRequest(page, 'POST', `/quizzes/${eventId}/questions`, segmentData);
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
  try {
    // Try health endpoint first (doesn't require auth)
    const healthUrl = `${BASE_URL}/api/health`;
    try {
      const response = await page.request.fetch(healthUrl, {
        method: 'GET',
        timeout: 3000,
      });
      // Any response means backend is available
      return response.ok || response.status < 500;
    } catch (e: any) {
      // Network errors mean backend is down
      if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed') || e.message?.includes('net::ERR')) {
        return false;
      }
      // Other errors (like timeout) - try auth endpoint
    }

    // Fallback: try auth endpoint (will return 401 if backend is up)
    const authUrl = `${BASE_URL}/api/auth/me`;
    try {
      const response = await page.request.fetch(authUrl, {
        method: 'GET',
        timeout: 2000,
      });
      // Any response means backend is available
      return true;
    } catch (e: any) {
      // 401 means backend is up, network errors mean it's down
      if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
        return true;
      }
      return false;
    }
  } catch {
    return false;
  }
}

