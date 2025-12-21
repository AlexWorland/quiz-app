import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { AccountSettingsPage } from '../AccountSettings'
import { useAuthStore } from '@/store/authStore'
import { authAPI } from '@/api/endpoints'

vi.mock('@/api/endpoints', () => {
  return {
    authAPI: {
      updateProfile: vi.fn(),
    },
  }
})

const mockUpdateProfile = authAPI.updateProfile as unknown as ReturnType<typeof vi.fn>

describe('AccountSettingsPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        username: 'current_user',
        email: 'user@example.com',
        role: 'participant',
        avatar_url: '😀',
        avatar_type: 'emoji',
      },
      token: 'token',
      isAuthenticated: true,
    } as any)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates profile and shows success', async () => {
    mockUpdateProfile.mockResolvedValue({
      data: {
        id: 'user-1',
        username: 'new_user',
        email: 'user@example.com',
        role: 'participant',
        avatar_url: 'https://example.com/avatar.png',
        avatar_type: 'custom',
      },
    })

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'new_user' } })
    fireEvent.change(screen.getByTestId('avatar-url'), { target: { value: 'https://example.com/avatar.png' } })
    fireEvent.change(screen.getByTestId('avatar-type'), { target: { value: 'custom' } })

    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('Profile updated successfully')
    })

    // Store should reflect new username
    const updatedUser = useAuthStore.getState().user
    expect(updatedUser?.username).toBe('new_user')
    expect(updatedUser?.avatar_url).toBe('https://example.com/avatar.png')
  })

  it('shows error on conflict', async () => {
    mockUpdateProfile.mockRejectedValue({
      response: { data: { message: 'Username already taken' } },
    })

    render(
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'existing_user' } })
    fireEvent.click(screen.getByTestId('save-button'))

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Username already taken')
    })
  })
})
