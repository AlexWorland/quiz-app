import { test, expect } from '@playwright/test';
import { loginUser, registerUser, clearAuth } from './fixtures/auth';
import { isBackendAvailable, createEvent, deleteEvent, createSegment } from './fixtures/api';

test.describe('Quiz Participation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);
  });

  test.describe('Participant Flow', () => {
    test('should display quiz interface when joining event', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      // Create event and segment as host
      await registerUser(page, {
        username: `host_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      const event = await createEvent(page, {
        title: `Quiz Event ${Date.now()}`,
      });

      const segment = await createSegment(page, event.id, {
        presenter_name: 'Test Presenter',
        title: 'Test Segment',
      });

      // Join as participant
      await clearAuth(page);
      await registerUser(page, {
        username: `participant_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto(`/events/${event.id}/segments/${segment.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show quiz interface
      await expect(
        page.getByText(/Waiting|Quiz|Segment|Participant/i)
      ).toBeVisible({ timeout: 10000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });

    test('should show waiting state before quiz starts', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      // Create event and segment
      await registerUser(page, {
        username: `host_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      const event = await createEvent(page, {
        title: `Quiz Event ${Date.now()}`,
      });

      const segment = await createSegment(page, event.id, {
        presenter_name: 'Test Presenter',
      });

      // Join as participant
      await clearAuth(page);
      await registerUser(page, {
        username: `participant_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto(`/events/${event.id}/segments/${segment.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show waiting or not started state
      await expect(
        page.getByText(/Waiting|Not Started|Waiting for quiz/i)
      ).toBeVisible({ timeout: 10000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });
  });

  test.describe('Presenter Flow', () => {
    test('should display presenter controls when user is presenter', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      // Create event and segment as presenter
      await registerUser(page, {
        username: `presenter_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      const event = await createEvent(page, {
        title: `Quiz Event ${Date.now()}`,
      });

      const segment = await createSegment(page, event.id, {
        presenter_name: 'Test Presenter',
      });

      await page.goto(`/events/${event.id}/segments/${segment.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show presenter controls
      await expect(
        page.getByText(/Start|Control|Presenter|Host/i)
      ).toBeVisible({ timeout: 10000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });

    test('should show recording controls for presenter', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      await registerUser(page, {
        username: `presenter_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      const event = await createEvent(page, {
        title: `Quiz Event ${Date.now()}`,
        mode: 'listen_only',
      });

      const segment = await createSegment(page, event.id, {
        presenter_name: 'Test Presenter',
      });

      await page.goto(`/events/${event.id}/segments/${segment.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show recording controls in listen_only mode
      await expect(
        page.getByText(/Record|Start Recording|Recording/i)
      ).toBeVisible({ timeout: 10000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });
  });

  test.describe('Answer Selection', () => {
    test('should display answer options when question is shown', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');

      // This test would require a quiz to be started with questions
      // For now, we'll skip detailed quiz flow tests as they require WebSocket setup
      test.skip(true, 'Requires active quiz session with WebSocket');
    });

    test('should allow selecting an answer', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');
      test.skip(true, 'Requires active quiz session with WebSocket');
    });

    test('should show correct answer after reveal', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');
      test.skip(true, 'Requires active quiz session with WebSocket');
    });
  });

  test.describe('Leaderboard', () => {
    test('should display leaderboard after question', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');
      test.skip(true, 'Requires active quiz session with WebSocket');
    });

    test('should show segment leaderboard', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');
      test.skip(true, 'Requires active quiz session with WebSocket');
    });

    test('should show master leaderboard', async ({ page }) => {
      const backendAvailable = await isBackendAvailable(page);
      test.skip(!backendAvailable, 'Backend not available - skipping test');
      test.skip(true, 'Requires active quiz session with WebSocket');
    });
  });
});

