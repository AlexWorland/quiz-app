import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/common/Button'
import { useNavigate } from 'react-router-dom'

export function HomePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-white">Quiz App</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">
              {user?.avatar_type === 'emoji' ? user.avatar_url : '👤'} {user?.username}
            </span>
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Welcome, {user?.username}!</h2>
          <p className="text-gray-400 mb-6">
            You're logged in as a {user?.role}. More features coming soon...
          </p>

          {user?.role === 'participant' && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-white">Participant Features</h3>
              <ul className="text-gray-400 space-y-2">
                <li>✓ Join quiz events via QR code or join code</li>
                <li>✓ Participate in segment quizzes</li>
                <li>✓ Draw in the collaborative canvas while waiting</li>
                <li>✓ View your scores and leaderboards</li>
              </ul>
            </div>
          )}

          {user?.role === 'presenter' && (
            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-white">Presenter Features</h3>
              <ul className="text-gray-400 space-y-2">
                <li>✓ Create events with multiple segments</li>
                <li>✓ Enable audio recording and AI question generation</li>
                <li>✓ Mark presentation segments</li>
                <li>✓ Control quiz flow and view real-time results</li>
                <li>✓ Generate QR code for participants to join</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
