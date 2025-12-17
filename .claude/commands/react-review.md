---
allowed-tools: Bash(npm run lint:*), Bash(npm run type-check:*), Bash(npx tsc:*)
argument-hint: [optional: component-name]
description: Review React frontend code for best practices and accessibility
---

# React Frontend Code Review

Review the React frontend code for this quiz application. Focus on $ARGUMENTS if specified, otherwise review all areas.

## Current Status
!`cd frontend && npm run type-check 2>&1 | head -20`

## Areas to Check
1. **Component Design**
   - Proper component composition and reusability
   - Correct use of hooks (useEffect dependencies, cleanup)
   - State management with Zustand stores
   - Props drilling vs context usage

2. **TypeScript**
   - Proper type definitions (no `any` types)
   - Interface vs type usage consistency
   - Generic types where appropriate
   - Null/undefined handling

3. **Performance**
   - Unnecessary re-renders
   - Memoization with useMemo/useCallback where needed
   - Lazy loading for routes
   - Image optimization

4. **WebSocket Handling**
   - Connection lifecycle management
   - Reconnection logic
   - Message parsing and validation
   - Error handling for disconnects

5. **Accessibility**
   - Semantic HTML elements
   - ARIA labels for interactive elements
   - Keyboard navigation
   - Color contrast (especially for dark/light modes)

6. **Tailwind CSS**
   - Consistent spacing and sizing
   - Dark mode class usage
   - Responsive breakpoints
   - No conflicting utility classes

## What to Review
Review recent changes in the `frontend/` directory.

Provide specific, actionable feedback with file paths and line numbers.
