import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { HomePage } from './pages/Home'
import { EventsPage } from './pages/Events'
import { EventDetailPage } from './pages/EventDetail'
import { EventHostPage } from './pages/EventHost'
import { EventParticipantPage } from './pages/EventParticipant'
import { JoinEventPage } from './pages/JoinEvent'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/join"
          element={
            <ProtectedRoute>
              <JoinEventPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events/:eventId"
          element={
            <ProtectedRoute>
              <EventDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events/:eventId/segments/:segmentId/host"
          element={
            <ProtectedRoute>
              <EventHostPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events/:eventId/segments/:segmentId/participant"
          element={
            <ProtectedRoute>
              <EventParticipantPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

export default App
