/**
 * Test utilities and best practices to prevent stalling tests
 * 
 * IMPORTANT: When using fake timers, follow these patterns:
 * 
 * 1. Use `fireEvent` instead of `userEvent` with fake timers
 *    ❌ BAD: await userEvent.click(button) with vi.useFakeTimers()
 *    ✅ GOOD: act(() => { fireEvent.click(button) })
 * 
 * 2. Use `act` and `vi.advanceTimersByTime` instead of `waitFor` with fake timers
 *    ❌ BAD: await waitFor(() => expect(...)) with fake timers
 *    ✅ GOOD: act(() => { vi.advanceTimersByTime(1000) }); expect(...)
 * 
 * 3. Always wrap timer advances in `act()`
 *    ❌ BAD: vi.advanceTimersByTime(1000)
 *    ✅ GOOD: act(() => { vi.advanceTimersByTime(1000) })
 * 
 * 4. Clean up timers in afterEach
 *    ✅ GOOD: afterEach(() => { vi.useRealTimers() })
 */

import { act, fireEvent, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { vi } from 'vitest';

/**
 * Helper to safely advance timers in tests
 * Always wraps timer advancement in act() to prevent React warnings
 */
export function advanceTimers(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * Helper to safely click elements with fake timers
 * Use this instead of userEvent.click() when using fake timers
 */
export function clickElement(element: HTMLElement) {
  act(() => {
    fireEvent.click(element);
  });
}

/**
 * Helper to safely type in inputs with fake timers
 * Use this instead of userEvent.type() when using fake timers
 */
export function typeInInput(input: HTMLElement, text: string) {
  act(() => {
    fireEvent.change(input, { target: { value: text } });
  });
}

/**
 * Setup fake timers with proper cleanup
 * Use this in beforeEach/afterEach hooks
 */
export function setupFakeTimers() {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}

