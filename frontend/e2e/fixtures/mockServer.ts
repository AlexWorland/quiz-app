import type { Page, Request } from '@playwright/test';
import { handleMockApi, useMocks } from './api';

const appliedPages = new WeakSet<Page>();

function parseData(request: Request): any | undefined {
  const postMethods = new Set(['POST', 'PUT', 'PATCH']);
  if (!postMethods.has(request.method())) return undefined;
  const body = request.postData();
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export async function ensureMockApi(page: Page): Promise<void> {
  if (!useMocks) return;
  if (appliedPages.has(page)) return;

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.replace(/\/+$/, '');
    const data = parseData(request);
    try {
      const result = await handleMockApi(request.method(), endpoint, data);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(result ?? {}),
      });
    } catch (err: any) {
      const status = err?.status || 500;
      const message = err?.message || 'Mock API error';
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: message }),
      });
    }
  });

  appliedPages.add(page);
}

