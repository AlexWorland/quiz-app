import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MockWebSocket } from './mocks/websocket';

interface MockAuthState {
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl?: string;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
}

export function createMockAuthState(overrides?: Partial<MockAuthState>): MockAuthState {
  return {
    user: {
      id: 1,
      username: 'testuser',
      displayName: 'Test User',
    },
    token: 'mock-jwt-token',
    isAuthenticated: true,
    ...overrides,
  };
}

interface AllTheProvidersProps {
  children: ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

export function waitForWebSocket(): Promise<MockWebSocket> {
  return new Promise((resolve) => {
    const checkWebSocket = () => {
      const ws = MockWebSocket.getLatest();
      if (ws) {
        resolve(ws);
      } else {
        setTimeout(checkWebSocket, 10);
      }
    };
    checkWebSocket();
  });
}

export * from '@testing-library/react';
export { customRender as render };
