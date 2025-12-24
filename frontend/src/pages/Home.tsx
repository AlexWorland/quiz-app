import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/common/Button'
import { useNavigate } from 'react-router-dom'
import { Zap, LogIn } from 'lucide-react'

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
            <Button onClick={() => navigate('/account')} variant="secondary">
              Account
            </Button>
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          </div>
        </div>

        <div className="bg-dark-900 rounded-lg shadow-xl p-8 border border-dark-700 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Welcome, {user?.username}!</h2>
          <p className="text-gray-400 mb-6">
            Ready to create or join engaging quiz events?
          </p>

          <div className="space-y-3">
            <ul className="text-gray-400 space-y-2 mb-6">
              <li>✓ Create events with multiple presentation segments</li>
              <li>✓ Join quiz events via QR code or join code</li>
              <li>✓ Enable audio recording and AI question generation</li>
              <li>✓ Participate in segment quizzes and view leaderboards</li>
            </ul>

            <div className="mt-8 pt-6 border-t border-dark-700 flex gap-4">
              <Button
                onClick={() => navigate('/events')}
                variant="primary"
                className="flex items-center gap-2 text-lg py-3"
              >
                <Zap size={20} />
                My Events
              </Button>
              <Button
                onClick={() => navigate('/join')}
                variant="secondary"
                className="flex items-center gap-2 text-lg py-3"
              >
                <LogIn size={20} />
                Join an Event
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">Join Event</h3>
            <p className="text-gray-400 text-sm mb-4">Enter a join code to participate in a quiz</p>
            <Button onClick={() => navigate('/join')} variant="primary" size="sm">
              Join Now
            </Button>
          </div>

          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">Create Event</h3>
            <p className="text-gray-400 text-sm mb-4">Start a new interactive event with segments</p>
            <Button onClick={() => navigate('/events')} variant="secondary" size="sm">
              Create Now
            </Button>
          </div>

          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">AI Questions</h3>
            <p className="text-gray-400 text-sm mb-4">
              Record audio and let AI generate quiz questions automatically.
            </p>
            <Button onClick={() => navigate('/events')} variant="secondary" size="sm">
              Go to Events
            </Button>
          </div>

          <div className="bg-dark-900 rounded-lg p-6 border border-dark-700">
            <h3 className="text-lg font-semibold text-white mb-2">Leaderboards</h3>
            <p className="text-gray-400 text-sm mb-4">
              View segment and master leaderboards for events.
            </p>
            <Button onClick={() => navigate('/events')} variant="secondary" size="sm">
              View Events
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
