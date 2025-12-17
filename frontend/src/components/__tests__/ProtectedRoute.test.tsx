import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../ProtectedRoute'
import { useAuthStore } from '@/store/authStore'

const TestChild = () => <div data-testid="protected-content">Protected Content</div>
const LoginPage = () => <div data-testid="login-page">Login Page</div>
const HomePage = () => <div data-testid="home-page">Home Page</div>

const renderWithRouter = (
  ui: React.ReactElement,
  { initialEntries = ['/protected'] } = {}
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/protected" element={ui} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
  })

  describe('when not authenticated', () => {
    it('should redirect to /login', () => {
      renderWithRouter(
        <ProtectedRoute>
          <TestChild />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })
  })

  describe('when authenticated', () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: 'user-1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'presenter',
        },
        token: 'valid-token',
        isAuthenticated: true,
      })
    })

    it('should render children when authenticated', () => {
      renderWithRouter(
        <ProtectedRoute>
          <TestChild />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should render children when role matches requiredRole', () => {
      renderWithRouter(
        <ProtectedRoute requiredRole="presenter">
          <TestChild />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
    })

    it('should redirect to / when role does not match requiredRole', () => {
      renderWithRouter(
        <ProtectedRoute requiredRole="participant">
          <TestChild />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('should handle null user gracefully', () => {
      useAuthStore.setState({
        user: null,
        token: 'token',
        isAuthenticated: true,
      })

      renderWithRouter(
        <ProtectedRoute requiredRole="presenter">
          <TestChild />
        </ProtectedRoute>
      )

      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })
  })
})
