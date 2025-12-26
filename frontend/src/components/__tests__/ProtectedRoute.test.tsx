import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock authStore with persist methods
const mockUseAuthStore = vi.fn();
const mockHasHydrated = vi.fn().mockReturnValue(true);
const mockOnFinishHydration = vi.fn().mockReturnValue(() => {});

// Add persist methods to the mock
mockUseAuthStore.persist = {
  hasHydrated: mockHasHydrated,
  onFinishHydration: mockOnFinishHydration,
};

vi.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: any) => mockUseAuthStore(selector),
    {
      persist: {
        hasHydrated: () => mockHasHydrated(),
        onFinishHydration: (cb: () => void) => mockOnFinishHydration(cb),
      },
    }
  ),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasHydrated.mockReturnValue(true);
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render children when authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should redirect to login when not authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Navigate component should redirect
    await waitFor(() => {
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  it('should allow access when user has required role', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'presenter' },
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="presenter">
        <div>Presenter Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Presenter Content')).toBeInTheDocument();
    });
  });

  it('should redirect when user does not have required role', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="presenter">
        <div>Presenter Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.queryByText('Presenter Content')).not.toBeInTheDocument();
    });
  });

  it('should allow access when requiredRole is not specified', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Any User Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Any User Content')).toBeInTheDocument();
    });
  });

  it('should render nothing while waiting for hydration', () => {
    mockHasHydrated.mockReturnValue(false);
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });

    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // Should not render anything while waiting
    expect(container.innerHTML).toBe('');
  });

  it('should allow anonymous participants with session token', async () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      user: null,
      sessionToken: 'session-token-123',
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Anonymous Participant Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByText('Anonymous Participant Content')).toBeInTheDocument();
    });
  });
});
