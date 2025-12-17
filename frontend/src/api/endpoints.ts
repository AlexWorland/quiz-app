import client from './client'
import { User } from '@/store/authStore'

export interface RegisterRequest {
  username: string
  password: string
  avatar_url: string
  avatar_type: 'emoji' | 'preset' | 'custom'
}

export interface LoginRequest {
  username: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

// Auth endpoints
export const authAPI = {
  register: (data: RegisterRequest) =>
    client.post<AuthResponse>('/auth/register', data),

  login: (data: LoginRequest) =>
    client.post<AuthResponse>('/auth/login', data),

  getMe: () =>
    client.get<User>('/auth/me'),

  updateProfile: (data: Partial<User>) =>
    client.put<User>('/auth/profile', data),
}

// Avatar upload
export const uploadAPI = {
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return client.post<{ url: string; file_name: string }>('/upload/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}
