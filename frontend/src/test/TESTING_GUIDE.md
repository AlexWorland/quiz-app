# Testing Guide - Preventing Stalling Tests

## Common Causes of Stalling Tests

### 1. Using `waitFor` with Fake Timers

**Problem:** `waitFor` uses real timeouts, which don't work with fake timers, causing tests to stall.

**❌ BAD:**
```typescript
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
await waitFor(() => {
  expect(screen.getByText('29s')).toBeInTheDocument();
});
```

**✅ GOOD:**
```typescript
vi.useFakeTimers();
act(() => {
  vi.advanceTimersByTime(1000);
});
expect(screen.getByText('29s')).toBeInTheDocument();
```

### 2. Using `userEvent` with Fake Timers

**Problem:** `userEvent` uses real timeouts internally, which conflict with fake timers.

**❌ BAD:**
```typescript
vi.useFakeTimers();
await userEvent.click(button);
```

**✅ GOOD:**
```typescript
vi.useFakeTimers();
act(() => {
  fireEvent.click(button);
});
```

### 3. Not Wrapping Timer Advances in `act()`

**Problem:** React state updates from timers need to be wrapped in `act()`.

**❌ BAD:**
```typescript
vi.advanceTimersByTime(1000);
expect(screen.getByText('29s')).toBeInTheDocument();
```

**✅ GOOD:**
```typescript
act(() => {
  vi.advanceTimersByTime(1000);
});
expect(screen.getByText('29s')).toBeInTheDocument();
```

### 4. Forgetting to Clean Up Timers

**Problem:** Fake timers persist between tests, causing unpredictable behavior.

**❌ BAD:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});
// Missing afterEach cleanup
```

**✅ GOOD:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Best Practices

### When to Use Fake Timers

- Testing components with `setInterval` or `setTimeout`
- Testing countdown timers
- Testing debounced/throttled functions
- Testing animations with time-based logic

### When NOT to Use Fake Timers

- Simple component rendering tests
- Tests that don't involve time-based logic
- Tests that use `userEvent` extensively (prefer real timers)

### Pattern for Timer-Based Tests

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

describe('MyComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should update after timer', () => {
    render(<MyComponent />);
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('Updated')).toBeInTheDocument();
  });

  it('should handle clicks with fake timers', () => {
    const onSelect = vi.fn();
    render(<MyComponent onSelect={onSelect} />);
    
    const button = screen.getByRole('button');
    act(() => {
      fireEvent.click(button);
    });
    
    expect(onSelect).toHaveBeenCalled();
  });
});
```

## Test Timeout Configuration

Tests have a default timeout of 5000ms configured in `vitest.config.ts`. If a test needs more time, explicitly set it:

```typescript
it('should handle long operation', async () => {
  // ... test code
}, { timeout: 10000 });
```

## Quick Reference

| Scenario | Use |
|----------|-----|
| Timer-based component | `vi.useFakeTimers()` + `act()` + `vi.advanceTimersByTime()` |
| User interactions with fake timers | `fireEvent` wrapped in `act()` |
| User interactions without fake timers | `userEvent` (async) |
| Waiting for async updates (no fake timers) | `waitFor()` |
| Waiting for timer updates (with fake timers) | `act()` + `vi.advanceTimersByTime()` + direct assertion |

## Helper Functions

Use the helpers from `src/test/test-utils.tsx`:

```typescript
import { advanceTimers, clickElement } from '@/test/test-utils';

// Instead of:
act(() => { vi.advanceTimersByTime(1000) });
act(() => { fireEvent.click(button) });

// Use:
advanceTimers(1000);
clickElement(button);
```

