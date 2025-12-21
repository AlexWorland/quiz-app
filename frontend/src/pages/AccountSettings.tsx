import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authAPI, type UpdateProfileRequest } from '@/api/endpoints'
import { Button } from '@/components/common/Button'
import { Input } from '@/components/common/Input'
import { useAuthStore } from '@/store/authStore'

export function AccountSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const navigate = useNavigate()

  const [username, setUsername] = useState(user?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '')
  const [avatarType, setAvatarType] = useState<UpdateProfileRequest['avatar_type']>(user?.avatar_type ?? 'emoji')
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState(false)

  if (!user) {
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('')
    setError('')
    setSaving(true)

    try {
      const payload: UpdateProfileRequest = {
        username: username.trim(),
        avatar_url: avatarUrl.trim() || undefined,
        avatar_type: avatarType,
      }

      const res = await authAPI.updateProfile(payload)
      updateUser(res.data)
      setStatus('Profile updated successfully')
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Failed to update profile'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Account Settings</h1>
            <p className="text-gray-400 mt-1">Update your username and avatar preferences.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <div className="bg-dark-900 border border-dark-700 rounded-lg p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                maxLength={50}
                placeholder="Choose a username"
                data-testid="username-input"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Avatar Type</label>
                <select
                  className="w-full bg-dark-800 border border-dark-700 rounded px-3 py-2 text-white"
                  value={avatarType}
                  onChange={(e) => setAvatarType(e.target.value as UpdateProfileRequest['avatar_type'])}
                  data-testid="avatar-type"
                >
                  <option value="emoji">Emoji</option>
                  <option value="preset">Preset</option>
                  <option value="custom">Custom URL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Avatar URL</label>
                <Input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png or emoji"
                  maxLength={500}
                  data-testid="avatar-url"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to keep current avatar.</p>
              </div>
            </div>

            {status && <div className="text-green-400 text-sm" data-testid="status">{status}</div>}
            {error && <div className="text-red-400 text-sm" data-testid="error">{error}</div>}

            <Button type="submit" variant="primary" loading={saving} disabled={saving} data-testid="save-button">
              Save Changes
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
