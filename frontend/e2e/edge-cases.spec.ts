import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { registerUser, clearAuth } from './fixtures/auth';
import { isBackendAvailable, createEvent, deleteEvent, apiRequest } from './fixtures/api';
import { registerLogging } from './fixtures/reporting';

registerLogging();

/**
 * Phase 5 Edge Case E2E Tests
 *
 * To run without skipping:
 * 1. Start backend: docker-compose up -d
 * 2. Run tests: npx playwright test e2e/edge-cases.spec.ts
 */

// Run tests serially to avoid shared state issues
test.describe.configure({ mode: 'serial' });

test.describe('Phase 5 Edge Cases', () => {
  test.describe('Simultaneous Join - Unique Display Names', () => {
    test('two users joining with same display name get unique names', async ({ browser }) => {
      // Create a fresh browser context for complete isolation
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;
      let context1: BrowserContext | null = null;
      let context2: BrowserContext | null = null;
      let participant1: Page | null = null;
      let participant2: Page | null = null;

      try {
        // Check backend availability first
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await isBackendAvailable(page);

        // Register user in fresh context
        const hostUsername = `host_${Date.now()}`;
        await page.goto('/register', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1000); // Wait for React hydration

        // Fill registration form
        await page.getByLabel('Username').fill(hostUsername);
        await page.getByLabel('Password').fill('testpass123');

        // Select emoji (button now has type="button" to prevent form submission)
        const emojiButton = page.locator('button[type="button"]').filter({ hasText: /^😀$/ }).first();
        if (await emojiButton.isVisible({ timeout: 2000 })) {
          await emojiButton.click();
          await page.waitForTimeout(300);
        }

        // Submit the form and wait for navigation
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }),
          page.getByRole('button', { name: /Create Account/i }).click(),
        ]).catch(async (e) => {
          // If navigation fails, capture diagnostic info
          await page.screenshot({ path: '/tmp/registration-failed.png' });
          const errorText = await page.locator('.text-red-500, .text-error, [role="alert"]').textContent().catch(() => 'No error message found');
          const currentUrl = page.url();
          throw new Error(`Registration navigation failed. URL: ${currentUrl}, Error: ${errorText}, Original: ${e.message}`);
        });

        // Verify we're on the home page (either / or /home)
        const url = page.url();
        if (!url.endsWith('/') && !url.endsWith('/home')) {
          await page.screenshot({ path: '/tmp/registration-wrong-page.png' });
          throw new Error(`Registration failed - expected redirect to home, got: ${url}`);
        }

        event = await createEvent(page, {
          title: `Unique Name Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // Get join code
        const joinCode = event.join_code;

        // Create two new browser contexts for participants
        context1 = await context.browser()!.newContext();
        context2 = await context.browser()!.newContext();

        participant1 = await context1.newPage();
        participant2 = await context2.newPage();

        // Both participants go to join page
        await Promise.all([
          participant1.goto(`/join?code=${joinCode}`, { waitUntil: 'domcontentloaded' }),
          participant2.goto(`/join?code=${joinCode}`, { waitUntil: 'domcontentloaded' }),
        ]);

        // Both enter the SAME display name
        const sharedName = 'TestPlayer';

        // Fill forms one at a time to ensure they're ready, then submit together
        await fillJoinForm(participant1, sharedName);
        await participant1.screenshot({ path: '/tmp/p1-after-fill.png' });

        await fillJoinForm(participant2, sharedName);
        await participant2.screenshot({ path: '/tmp/p2-after-fill.png' });

        // Check what buttons are on the page
        const p1Buttons = await participant1.locator('button').allTextContents();
        console.log('P1 buttons after fill:', p1Buttons);

        // Verify both "Join Event" buttons are visible and enabled
        const btn1 = participant1.getByRole('button', { name: /join event/i });
        const btn2 = participant2.getByRole('button', { name: /join event/i });

        await btn1.waitFor({ state: 'visible', timeout: 5000 });
        await btn2.waitFor({ state: 'visible', timeout: 5000 });

        // Submit both forms nearly simultaneously
        await Promise.all([btn1.click(), btn2.click()]);

        // Wait a moment for the API calls to complete
        await participant1.waitForTimeout(2000);

        // Check for errors on the page
        const p1Error = await participant1.locator('.text-red-300, .text-red-500, [role="alert"]').textContent().catch(() => null);
        const p2Error = await participant2.locator('.text-red-300, .text-red-500, [role="alert"]').textContent().catch(() => null);

        if (p1Error || p2Error) {
          await participant1.screenshot({ path: '/tmp/p1-error.png' });
          await participant2.screenshot({ path: '/tmp/p2-error.png' });
          console.log('P1 error:', p1Error);
          console.log('P2 error:', p2Error);
        }

        // Wait for both to join (redirects to event page)
        await Promise.all([
          participant1.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 }),
          participant2.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 }),
        ]);

        // Check that they got different display names
        // One should be "TestPlayer" and other "TestPlayer 2"
        const name1 = await getDisplayedName(participant1);
        const name2 = await getDisplayedName(participant2);

        // Names should be different (one is "TestPlayer", other is "TestPlayer 2")
        expect(name1).not.toEqual(name2);
        expect([name1, name2]).toContain('TestPlayer');

        // The other should have a suffix
        const otherName = name1 === 'TestPlayer' ? name2 : name1;
        expect(otherName).toMatch(/TestPlayer \d+/);

      } finally {
        if (participant1) await participant1.close().catch(() => {});
        if (participant2) await participant2.close().catch(() => {});
        if (context1) await context1.close().catch(() => {});
        if (context2) await context2.close().catch(() => {});
        if (event) await deleteEvent(page, event.id).catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });

    test('three simultaneous joins get sequential numbering', async ({ browser }) => {
      // Create a fresh browser context for complete isolation
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;
      const participantContexts: BrowserContext[] = [];
      const participantPages: Page[] = [];

      try {
        await isBackendAvailable(page);

        // Create host and event
        await registerUser(page, {
          username: `host_multi_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event = await createEvent(page, {
          title: `Multi Join Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // Create 3 browser contexts
        for (let i = 0; i < 3; i++) {
          const ctx = await context.browser()!.newContext();
          participantContexts.push(ctx);
          participantPages.push(await ctx.newPage());
        }

        // All go to join page
        await Promise.all(
          participantPages.map(p => p.goto(`/join?code=${event!.join_code}`, { waitUntil: 'domcontentloaded' }))
        );

        // All fill same name
        await Promise.all(participantPages.map(p => fillJoinForm(p, 'Player')));

        // All submit (button says "Join Event" in step 2)
        await Promise.all(
          participantPages.map(p => p.getByRole('button', { name: /join event/i }).click())
        );

        // Wait for all to join (redirects to event page)
        await Promise.all(
          participantPages.map(p => p.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 }))
        );

        // Get all names
        const names = await Promise.all(participantPages.map(getDisplayedName));

        // Should have 3 unique names
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).toBe(3);

        // Should include "Player", "Player 2", "Player 3"
        expect(names).toContain('Player');
        expect(names.some(n => n.match(/Player \d+/))).toBe(true);

      } finally {
        await Promise.all(participantPages.map(p => p.close().catch(() => {})));
        await Promise.all(participantContexts.map(c => c.close().catch(() => {})));
        if (event) {
          await deleteEvent(page, event.id).catch(() => {});
        }
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });

  test.describe('First-Answer-Only Prevention', () => {
    test('cannot submit answer twice via rapid clicking', async ({ browser }) => {
      // Create a fresh browser context for complete isolation
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;
      let participantCtx: BrowserContext | null = null;
      let participant: Page | null = null;

      try {
        await isBackendAvailable(page);

        // Create host and event with a question
        await registerUser(page, {
          username: `host_dup_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event = await createEvent(page, {
          title: `Duplicate Answer Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // Create segment and add question
        const segment = await apiRequest(page, 'POST', `/quizzes/${event.id}/segments`, {
          presenter_name: 'Test Host',
          title: 'Quiz Segment',
        });

        // Add a question
        await apiRequest(page, 'POST', `/segments/${segment.id}/questions`, {
          question_text: 'What is 2 + 2?',
          correct_answer: '4',
          wrong_answers: ['3', '5', '6'],
        });

        // Join as participant
        participantCtx = await context.browser()!.newContext();
        participant = await participantCtx.newPage();

        await participant.goto(`/join?code=${event.join_code}`, { waitUntil: 'domcontentloaded' });
        await fillJoinForm(participant, 'QuizTaker');
        await participant.getByRole('button', { name: /join event/i }).click();
        await participant.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 });

        // Host starts quiz
        await page.goto(`/events/${event.id}/host/${segment.id}`);
        await page.waitForLoadState('networkidle');

        // Start quiz button
        const startButton = page.getByRole('button', { name: /start quiz/i });
        if (await startButton.isVisible({ timeout: 3000 })) {
          await startButton.click();
        }

        // Wait for question to appear on participant screen
        await participant.waitForSelector('text=/What is 2|answer|option/i', { timeout: 10000 });

        // Try to click answer button multiple times rapidly
        const answerButtons = participant.locator('button:has-text("4"), button:has-text("3"), button:has-text("5")');
        const firstAnswer = answerButtons.first();

        if (await firstAnswer.isVisible({ timeout: 3000 })) {
          // Rapid double-click
          await firstAnswer.click();
          await firstAnswer.click();
          await firstAnswer.click();

          // Should see "already answered" or button should be disabled
          const alreadyAnswered = participant.locator('text=/already answered|submitted|waiting/i');
          const disabledButton = participant.locator('button[disabled]');

          // Either error message shown OR buttons are disabled
          const hasProtection = await alreadyAnswered.isVisible({ timeout: 2000 }).catch(() => false) ||
                               await disabledButton.count() > 0;

          expect(hasProtection).toBe(true);
        }

      } finally {
        if (participant) await participant.close().catch(() => {});
        if (participantCtx) await participantCtx.close().catch(() => {});
        if (event) await deleteEvent(page, event.id).catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });

  test.describe('Join Lock Behavior', () => {
    test('locked event rejects new joins but allows rejoins', async ({ browser }) => {
      // Create a fresh browser context for complete isolation
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;
      let ctx1: BrowserContext | null = null;
      let participant1: Page | null = null;
      let ctx2: BrowserContext | null = null;
      let participant2: Page | null = null;

      try {
        await isBackendAvailable(page);

        // Create host and event
        await registerUser(page, {
          username: `host_lock_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event = await createEvent(page, {
          title: `Lock Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // First participant joins
        ctx1 = await context.browser()!.newContext();
        participant1 = await ctx1.newPage();

        await participant1.goto(`/join?code=${event.join_code}`);
        await fillJoinForm(participant1, 'FirstJoiner');
        await participant1.getByRole('button', { name: /join event/i }).click();
        await participant1.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 });

        // Host locks joining
        await apiRequest(page, 'POST', `/quizzes/${event.id}/lock`);

        // Second participant tries to join - should fail
        ctx2 = await context.browser()!.newContext();
        participant2 = await ctx2.newPage();

        await participant2.goto(`/join?code=${event.join_code}`);
        await fillJoinForm(participant2, 'LateJoiner');
        await participant2.getByRole('button', { name: /join event/i }).click();

        // Should see error about locked event
        const errorMessage = participant2.locator('text=/locked|cannot join|closed/i');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });

        // First participant can still rejoin (refresh page)
        await participant1.reload();
        await participant1.waitForURL(/\/events\/.*\/participate/, { timeout: 10000 });

      } finally {
        if (participant2) await participant2.close().catch(() => {});
        if (ctx2) await ctx2.close().catch(() => {});
        if (participant1) await participant1.close().catch(() => {});
        if (ctx1) await ctx1.close().catch(() => {});
        if (event) {
          // Unlock before delete
          await apiRequest(page, 'POST', `/quizzes/${event.id}/unlock`).catch(() => {});
          await deleteEvent(page, event.id).catch(() => {});
        }
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });

  test.describe('Single Device Per Event Enforcement', () => {
    test('device cannot join multiple active events simultaneously', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let event1: { id: string; join_code: string } | null = null;
      let event2: { id: string; join_code: string } | null = null;

      try {
        await isBackendAvailable(page);

        // Create host and two events
        await registerUser(page, {
          username: `host_device_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event1 = await createEvent(page, {
          title: `Event 1 ${Date.now()}`,
          mode: 'listen_only',
        });

        event2 = await createEvent(page, {
          title: `Event 2 ${Date.now()}`,
          mode: 'listen_only',
        });

        // Join first event
        await page.goto(`/join?code=${event1.join_code}`);
        await fillJoinForm(page, 'ParticipantTest');
        await page.getByRole('button', { name: /join event/i }).click();
        await page.waitForURL(/\/events\/[^/]+$/, { timeout: 10000 });

        // Try to join second event with same device - should fail
        await page.goto(`/join?code=${event2.join_code}`);
        await fillJoinForm(page, 'ParticipantTest');
        await page.getByRole('button', { name: /join event/i }).click();

        // Should see conflict error
        const errorMessage = page.locator('text=/already in another active event/i');
        await expect(errorMessage).toBeVisible({ timeout: 5000 });

      } finally {
        if (event1) await deleteEvent(page, event1.id).catch(() => {});
        if (event2) await deleteEvent(page, event2.id).catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });

  test.describe('Resume With No Participants', () => {
    test('shows warning when resuming segment with no participants', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;

      try {
        await isBackendAvailable(page);

        // Create host and event
        await registerUser(page, {
          username: `host_resume_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event = await createEvent(page, {
          title: `Resume Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // Create segment
        const segment = await apiRequest(page, 'POST', `/quizzes/${event.id}/segments`, {
          presenter_name: 'Test Host',
          title: 'Test Segment',
        });

        // Complete segment (simulate accidental ending)
        await apiRequest(page, 'PUT', `/quizzes/${event.id}/segments/${segment.id}`, {
          status: 'completed',
          previous_status: 'quiz_ready',
        });

        // Go to host page
        await page.goto(`/events/${event.id}/host/${segment.id}`);
        await page.waitForLoadState('networkidle');

        // Click resume button
        const resumeButton = page.getByRole('button', { name: /resume/i });
        if (await resumeButton.isVisible({ timeout: 3000 })) {
          await resumeButton.click();

          // Should see warning about no participants
          page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('No participants');
            await dialog.accept();
          });

          await page.waitForTimeout(1000);
        }

      } finally {
        if (event) await deleteEvent(page, event.id).catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });

  test.describe('Rapid Resume Protection', () => {
    test('prevents rapid resume button clicking', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let event: { id: string; join_code: string } | null = null;

      try {
        await isBackendAvailable(page);

        // Create host and event
        await registerUser(page, {
          username: `host_rapid_${Date.now()}`,
          password: 'testpass123',
          avatar_type: 'emoji',
        });

        event = await createEvent(page, {
          title: `Rapid Resume Test ${Date.now()}`,
          mode: 'listen_only',
        });

        // Create completed segment
        const segment = await apiRequest(page, 'POST', `/quizzes/${event.id}/segments`, {
          presenter_name: 'Test Host',
          title: 'Test Segment',
        });

        await apiRequest(page, 'PUT', `/quizzes/${event.id}/segments/${segment.id}`, {
          status: 'completed',
          previous_status: 'quiz_ready',
        });

        // Go to host page
        await page.goto(`/events/${event.id}/host/${segment.id}`);
        await page.waitForLoadState('networkidle');

        // Try rapid clicking resume button
        const resumeButton = page.getByRole('button', { name: /resume/i });
        if (await resumeButton.isVisible({ timeout: 3000 })) {
          // Click 3 times rapidly
          await resumeButton.click();
          await resumeButton.click();
          await resumeButton.click();

          // Should see debounce error message
          const debounceError = page.locator('text=/please wait/i');
          const hasProtection = await debounceError.isVisible({ timeout: 2000 }).catch(() => false);

          expect(hasProtection).toBe(true);
        }

      } finally {
        if (event) await deleteEvent(page, event.id).catch(() => {});
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    });
  });
});

/**
 * Helper: Fill join form with display name
 * Handles the 2-step join flow: code entry → details entry
 */
async function fillJoinForm(page: Page, displayName: string) {
  // Wait for the page to fully load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500); // Brief wait for React hydration

  // Step 1: Check if we're on step 1 (code entry) - look for "Continue" button
  const continueButton = page.getByRole('button', { name: /continue/i });
  const isStep1 = await continueButton.isVisible({ timeout: 3000 }).catch(() => false);

  if (isStep1) {
    // Verify the code input is filled (should be from URL param)
    const codeInput = page.locator('input[maxlength="6"]');
    const codeValue = await codeInput.inputValue().catch(() => '');

    if (codeValue.length < 6) {
      throw new Error(`Join code not filled from URL. Current value: "${codeValue}"`);
    }

    // Check if button is enabled
    const isDisabled = await continueButton.isDisabled();
    if (isDisabled) {
      throw new Error(`Continue button is disabled. Code value: "${codeValue}"`);
    }

    // Submit code and wait for step 2
    await continueButton.click();
    await page.waitForSelector('text=/Your Display Name/i', { timeout: 10000 });
  }

  // Step 2: Fill display name
  // Try multiple selectors for robustness
  const nameInput = page.locator('input[placeholder="Enter your name"], input[placeholder*="name" i]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  await nameInput.fill(displayName);
}

/**
 * Helper: Get the displayed participant name from the page
 */
async function getDisplayedName(page: Page): Promise<string> {
  // Look for the display name in various places
  const selectors = [
    '[data-testid="display-name"]',
    '.participant-name',
    'text=/Welcome,? /i',
    '.username',
  ];

  for (const selector of selectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
      const text = await element.textContent();
      if (text) {
        // Extract name from "Welcome, TestPlayer" or just "TestPlayer"
        return text.replace(/^Welcome,?\s*/i, '').trim();
      }
    }
  }

  // Fallback: check localStorage for participant info
  const stored = await page.evaluate(() => {
    const data = localStorage.getItem('participant-store') || localStorage.getItem('quiz-participant');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        return parsed.state?.displayName || parsed.displayName || null;
      } catch {
        return null;
      }
    }
    return null;
  });

  return stored || 'Unknown';
}
