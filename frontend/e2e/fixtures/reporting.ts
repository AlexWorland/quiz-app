import { test } from '@playwright/test';

export function registerLogging(): void {
  test.afterEach(async ({}, testInfo) => {
    const status = testInfo.status;
    const errorMessage = testInfo.error?.message ? ` | error: ${testInfo.error.message}` : '';
    // eslint-disable-next-line no-console
    console.log(`[E2E] ${testInfo.title} | status: ${status}${errorMessage}`);
  });
}

