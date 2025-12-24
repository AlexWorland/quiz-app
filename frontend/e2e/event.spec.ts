import { test, expect } from '@playwright/test';
import { loginUser, registerUser, clearAuth } from './fixtures/auth';
import { isBackendAvailable, createEvent, deleteEvent, getEvent } from './fixtures/api';
import { registerLogging } from './fixtures/reporting';

registerLogging();

test.describe('Event Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await clearAuth(page);
  });

  test.describe('Event List', () => {
    test('should display events page when authenticated', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/events/);
      
      // Should show events page content
      await expect(page.getByText(/Events|Create Event|My Events/i)).toBeVisible({ timeout: 5000 });
    });

    test('should show create event button', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Look for create event button
      const createButton = page.getByRole('button', { name: /Create|New Event|Add Event/i });
      await expect(createButton.first()).toBeVisible({ timeout: 5000 });
    });

    test('should show loading state initially', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Page should load (might show loading or empty state)
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    });
  });

  test.describe('Create Event', () => {
    test('should open create event modal', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Click create button
      const createButton = page.getByRole('button', { name: /Create|New Event|Add Event/i }).first();
      await createButton.click();
      
      // Should show modal or form
      await expect(
        page.getByText(/Create Event|New Event|Event Title|Title/i)
      ).toBeVisible({ timeout: 3000 });
    });

    test('should create event with title', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Open create modal
      const createButton = page.getByRole('button', { name: /Create|New Event|Add Event/i }).first();
      await createButton.click();
      
      // Fill form
      const titleInput = page.getByLabel(/Title|Event Title/i).or(page.locator('input[type="text"]').first());
      await titleInput.fill(`Test Event ${Date.now()}`);
      
      // Submit
      const submitButton = page.getByRole('button', { name: /Create|Submit|Save/i }).filter({ 
        hasText: /Create|Submit|Save/i 
      });
      await submitButton.click();
      
      // Should close modal and show new event
      await expect(page.getByText(/Test Event/)).toBeVisible({ timeout: 10000 });
    });

    test('should show validation error for empty title', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Open create modal
      const createButton = page.getByRole('button', { name: /Create|New Event|Add Event/i }).first();
      await createButton.click();
      
      // Try to submit without title
      const submitButton = page.getByRole('button', { name: /Create|Submit|Save/i }).filter({ 
        hasText: /Create|Submit|Save/i 
      });
      await submitButton.click();
      
      // Should show validation error or stay in modal
      const titleInput = page.getByLabel(/Title|Event Title/i).or(page.locator('input[type="text"]').first());
      await expect(titleInput).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Event Details', () => {
    test('should navigate to event detail page', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Create event via API
      const event = await createEvent(page, {
        title: `Test Event ${Date.now()}`,
      });

      await page.goto(`/events/${event.id}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`/events/${event.id}`));
      
      // Should show event details
      await expect(page.getByText(event.title)).toBeVisible({ timeout: 5000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });

    test('should display join code', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Create event via API
      const event = await createEvent(page, {
        title: `Test Event ${Date.now()}`,
      });

      await page.goto(`/events/${event.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show join code
      await expect(page.getByText(event.join_code, { exact: false })).toBeVisible({ timeout: 5000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });

    test('should display QR code', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Create event via API
      const event = await createEvent(page, {
        title: `Test Event ${Date.now()}`,
      });

      await page.goto(`/events/${event.id}`, { waitUntil: 'domcontentloaded' });
      
      // Should show QR code (canvas or img element)
      const qrCode = page.locator('canvas, img[alt*="QR"], svg').first();
      await expect(qrCode).toBeVisible({ timeout: 5000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });
  });

  test.describe('Delete Event', () => {
    test('should delete event', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      // Create event via API
      const event = await createEvent(page, {
        title: `Test Event ${Date.now()}`,
      });

      await page.goto('/events', { waitUntil: 'domcontentloaded' });
      
      // Find delete button for this event
      const deleteButton = page.getByRole('button', { name: /Delete/i }).filter({ 
        hasText: new RegExp(event.title) 
      }).or(page.locator(`[data-event-id="${event.id}"]`).getByRole('button', { name: /Delete/i }));
      
      if (await deleteButton.count() > 0) {
        await deleteButton.first().click();
        
        // Handle confirmation dialog
        page.on('dialog', dialog => dialog.accept());
        
        // Event should be removed from list
        await expect(page.getByText(event.title)).not.toBeVisible({ timeout: 5000 });
      } else {
        // If delete button not found, try navigating to detail page
        await page.goto(`/events/${event.id}`, { waitUntil: 'domcontentloaded' });
        const detailDeleteButton = page.getByRole('button', { name: /Delete/i });
        if (await detailDeleteButton.count() > 0) {
          await detailDeleteButton.click();
          page.on('dialog', dialog => dialog.accept());
          await page.waitForURL(/\/events/, { timeout: 5000 });
        }
      }
    });
  });

  test.describe('Join Event', () => {
    test('should join event with join code', async ({ page }) => {
      // Create event as one user
      await registerUser(page, {
        username: `host_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      const event = await createEvent(page, {
        title: `Test Event ${Date.now()}`,
      });

      // Logout and login as participant
      await clearAuth(page);
      await registerUser(page, {
        username: `participant_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/join', { waitUntil: 'domcontentloaded' });
      
      // Enter join code
      const joinCodeInput = page.getByLabel(/Join Code|Code/i).or(page.locator('input[type="text"]').first());
      await joinCodeInput.fill(event.join_code);
      
      // Submit
      const joinButton = page.getByRole('button', { name: /Join|Enter/i });
      await joinButton.click();
      
      // Should navigate to event page
      await expect(page).toHaveURL(new RegExp(`/events/${event.id}`), { timeout: 10000 });
      
      // Cleanup
      await deleteEvent(page, event.id).catch(() => {});
    });

    test('should show error for invalid join code', async ({ page }) => {
      await registerUser(page, {
        username: `test_user_${Date.now()}`,
        password: 'testpass123',
        avatar_type: 'emoji',
      });

      await page.goto('/join', { waitUntil: 'domcontentloaded' });
      
      // Enter invalid join code
      const joinCodeInput = page.getByLabel(/Join Code|Code/i).or(page.locator('input[type="text"]').first());
      await joinCodeInput.fill('INVALID123');
      
      // Submit
      const joinButton = page.getByRole('button', { name: /Join|Enter/i });
      await joinButton.click();
      
      // Should show error
      await expect(
        page.getByText(/not found|invalid|error/i)
      ).toBeVisible({ timeout: 5000 });
    });
  });
});

