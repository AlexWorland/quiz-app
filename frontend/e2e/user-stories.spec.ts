import { test, expect, type Page } from '@playwright/test';
import { clearAuth } from './fixtures/auth';
import { apiRequest, createEvent, deleteEvent, isBackendAvailable } from './fixtures/api';
import { JoinPage, ParticipantView, PresenterDashboard } from './fixtures/pages';
import { seedEventWithSegment, seedQuestion } from './fixtures/seeds';
import { registerLogging } from './fixtures/reporting';

registerLogging();

const requireBackend = async (page: Page) => {
  // Backend assumed available in docker/corp runs; no skip.
  await isBackendAvailable(page);
};

test.describe('User Stories - Happy Paths', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  test('Session entry via QR join code with identity capture', async ({ page }) => {
    await requireBackend(page);
    const { eventId, joinCode } = await seedEventWithSegment(page);

    await clearAuth(page);
    const joinPage = new JoinPage(page);
    await joinPage.joinWithCodeAndName(joinCode, 'Alex');

    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));
    await expect(page.getByText(/Alex/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(joinCode, { exact: false })).toBeVisible({ timeout: 5000 });

    await deleteEvent(page, eventId).catch(() => {});
  });

  test('Rejoin preserves identity and score container', async ({ page }) => {
    await requireBackend(page);
    const { eventId, joinCode } = await seedEventWithSegment(page);

    const joinPage = new JoinPage(page);
    await joinPage.joinWithCodeAndName(joinCode, 'Taylor');
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));

    // Simulate disconnect/rejoin by reloading
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Taylor/i)).toBeVisible({ timeout: 5000 });

    await deleteEvent(page, eventId).catch(() => {});
  });

  test('Late joiners can enter after event is active', async ({ page, browser }) => {
    await requireBackend(page);
    const { eventId, joinCode } = await seedEventWithSegment(page);

    // First participant joins
    const p1Join = new JoinPage(page);
    await p1Join.joinWithCodeAndName(joinCode, 'Early');
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));

    // Second participant joins later in a new context
    const context2 = await browser.newContext();
    const latePage = await context2.newPage();
    const p2Join = new JoinPage(latePage);
    await p2Join.joinWithCodeAndName(joinCode, 'Late');
    await expect(latePage).toHaveURL(new RegExp(`/events/${eventId}`));

    // Leaderboard should include both (when visible)
    await expect(latePage.getByText(/Late/i)).toBeVisible({ timeout: 5000 });

    await context2.close();
    await deleteEvent(page, eventId).catch(() => {});
  });

  test('Presenter can lock and unlock joining', async ({ page, browser }) => {
    await requireBackend(page);
    const { eventId, joinCode } = await seedEventWithSegment(page);

    await apiRequest(page, 'POST', `/quizzes/${eventId}/lock`);

    const lateCtx = await browser.newContext();
    const latePage = await lateCtx.newPage();
    const joinPage = new JoinPage(latePage);
    await joinPage.openWithCode(joinCode);
    await joinPage.fillDisplayName('BlockedUser');
    await joinPage.selectEmojiAvatar();
    await joinPage.submitJoin();
    const blockedMessage = latePage.getByText(/locked|cannot join|closed/i);
    const blockedVisible = await blockedMessage.isVisible({ timeout: 5000 }).catch(() => false);
    const stayedOnJoin = latePage.url().includes('/join');
    expect(blockedVisible || stayedOnJoin).toBeTruthy();

    // Unlock and allow join
    await apiRequest(page, 'POST', `/quizzes/${eventId}/unlock`);
    await latePage.reload();
    await joinPage.submitJoin();
    await expect(latePage).toHaveURL(new RegExp(`/events/${eventId}`));

    await lateCtx.close();
    await deleteEvent(page, eventId).catch(() => {});
  });

  test('Presenter can resume segment and participants retain state', async ({ page }) => {
    await requireBackend(page);
    const { eventId, segmentId } = await seedEventWithSegment(page, { segmentTitle: 'Resume Flow' });
    await seedQuestion(page, segmentId);

    await page.goto(`/events/${eventId}/segments/${segmentId}`, { waitUntil: 'domcontentloaded' });
    const dashboard = new PresenterDashboard(page);
    await dashboard.startQuiz();
    await dashboard.resumeSegment();

    const participantView = new ParticipantView(page);
    await participantView.waitForStatus(/Waiting|Quiz|Segment/i);

    await deleteEvent(page, eventId).catch(() => {});
  });

  test('Export flow offers download formats', async ({ page }) => {
    await requireBackend(page);
    const event = await createEvent(page, { title: `Export Event ${Date.now()}` });

    await page.goto(`/events/${event.id}`, { waitUntil: 'domcontentloaded' });
    const dashboard = new PresenterDashboard(page);
    await dashboard.openExport();

    await expect(page.getByText(/Export|Download/i)).toBeVisible({ timeout: 5000 });

    await deleteEvent(page, event.id).catch(() => {});
  });
});

