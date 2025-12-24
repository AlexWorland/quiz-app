import { test, expect } from '@playwright/test';

test.describe('Late join handling and completion messaging', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth state for participant
    await page.goto('about:blank');
    await page.evaluate(() => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          state: {
            user: { id: 'user-1', username: 'alice', role: 'participant' },
            token: 'token',
            deviceId: 'device-1',
            sessionToken: 'session-1',
          },
        })
      );
    });

    // Stub WebSocket to drive client messages
    await page.addInitScript(() => {
      const sockets: any[] = [];
      class MockWebSocket {
        url: string;
        readyState = 1;
        onopen: ((ev: any) => void) | null = null;
        onmessage: ((ev: any) => void) | null = null;
        onclose: ((ev: any) => void) | null = null;
        onerror: ((ev: any) => void) | null = null;

        constructor(url: string) {
          this.url = url;
          sockets.push(this);
          setTimeout(() => this.onopen?.({}), 0);
        }

        send(_data: string) {
          // no-op
        }

        close() {
          this.readyState = 3;
          this.onclose?.({});
        }
      }

      (window as any).__mockSockets = sockets;
      (window as any).__pushWsMessage = (msg: any) => {
        sockets.forEach((ws) => ws.onmessage?.({ data: JSON.stringify(msg) }));
      };

      // @ts-ignore override
      window.WebSocket = MockWebSocket;
    });
  });

  test('shows late join notice, segment complete, and final results', async ({ page }) => {
    await page.goto('/events/evt1/segment/seg1');

    // Connected with late join status
    await page.evaluate(() =>
      (window as any).__pushWsMessage({
        type: 'connected',
        participants: [{ id: 'user-1', username: 'alice', join_status: 'waiting_for_segment' }],
      })
    );

    // Active question
    await page.evaluate(() =>
      (window as any).__pushWsMessage({
        type: 'question',
        question_id: 'q1',
        question_number: 1,
        total_questions: 1,
        text: 'Question 1',
        answers: ['A1', 'A2'],
        time_limit: 30,
      })
    );

    // Late join error
    await page.evaluate(() =>
      (window as any).__pushWsMessage({
        type: 'error',
        message: 'You can start answering with the next question',
      })
    );

    await expect(page.getByText(/joined mid-question/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /A1/ })).toBeDisabled();

    // Segment complete message
    await page.evaluate(() =>
      (window as any).__pushWsMessage({
        type: 'segment_complete',
        segment_id: 'seg1',
        segment_title: 'Segment 1',
        presenter_name: 'Presenter',
        segment_leaderboard: [],
        event_leaderboard: [],
        segment_winner: null,
        event_leader: null,
      })
    );

    await expect(page.getByText('Segment 1')).toBeVisible();

    // Event complete message
    await page.evaluate(() =>
      (window as any).__pushWsMessage({
        type: 'event_complete',
        event_id: 'evt1',
        final_leaderboard: [
          { rank: 1, user_id: 'user-1', username: 'alice', score: 10 },
          { rank: 2, user_id: 'user-2', username: 'bob', score: 5 },
        ],
        winner: { rank: 1, user_id: 'user-1', username: 'alice', score: 10 },
        segment_winners: [],
      })
    );

    await expect(page.getByText(/Final Standings/i)).toBeVisible();
    await expect(page.getByText('alice')).toBeVisible();
  });
});

