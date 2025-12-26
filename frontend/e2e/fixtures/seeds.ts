import type { Page } from '@playwright/test';
import { createEvent, createSegment, apiRequest } from './api';
import { clearAuth, registerUser } from './auth';
import { ensureMockApi } from './mockServer';

export interface SeededEvent {
  eventId: string;
  joinCode: string;
  segmentId: string;
  hostUsername: string;
}

/**
 * Creates a host user, event, and segment for quiz flows.
 * Uses UI registration to align with auth flows.
 */
export async function seedEventWithSegment(
  page: Page,
  options?: { mode?: 'listen_only' | 'normal'; segmentTitle?: string }
): Promise<SeededEvent> {
  await ensureMockApi(page);
  const hostUsername = `host_${Date.now()}`;
  await registerUser(page, {
    username: hostUsername,
    password: 'testpass123',
    avatar_type: 'emoji',
  });

  const event = await createEvent(page, {
    title: `E2E Event ${Date.now()}`,
    mode: options?.mode ?? 'listen_only',
  });

  const segment = await createSegment(page, event.id, {
    presenter_name: hostUsername,
    title: options?.segmentTitle ?? 'Segment 1',
  });

  return {
    eventId: event.id,
    joinCode: event.join_code,
    segmentId: segment.id,
    hostUsername,
  };
}

/**
 * Adds a simple multiple-choice question to a segment.
 */
export async function seedQuestion(
  page: Page,
  segmentId: string,
  questionText = 'What is 2 + 2?'
): Promise<void> {
  await apiRequest(page, 'POST', `/segments/${segmentId}/questions`, {
    question_text: questionText,
    correct_answer: '4',
    wrong_answers: ['3', '5', '6'],
  });
}

/**
 * Registers a participant account using the UI and clears auth for reuse.
 */
export async function seedParticipant(page: Page, prefix = 'participant'): Promise<{ username: string }> {
  const username = `${prefix}_${Date.now()}`;
  await registerUser(page, {
    username,
    password: 'testpass123',
    avatar_type: 'emoji',
  });
  await clearAuth(page);
  return { username };
}

