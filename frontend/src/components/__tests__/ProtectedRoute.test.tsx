import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock authStore
const mockUseAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: any) => mockUseAuthStore(selector),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('should render children when authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
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
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should allow access when user has required role', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'presenter' },
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="presenter">
        <div>Presenter Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Presenter Content')).toBeInTheDocument();
  });

  it('should redirect when user does not have required role', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="presenter">
        <div>Presenter Content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Presenter Content')).not.toBeInTheDocument();
  });

  it('should allow access when requiredRole is not specified', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      user: { id: '1', username: 'test', role: 'participant' },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Any User Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Any User Content')).toBeInTheDocument();
  });
});

