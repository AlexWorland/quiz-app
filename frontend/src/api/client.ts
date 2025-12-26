import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { withRetry, isRetryableError } from '@/utils/retry'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const client: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  } else {
    console.warn('[API Client] No token found in auth store for request:', config.url)
  }
  return config
})

// Handle 401 responses and retry logic
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // Don't retry if no config, already retried, or not retryable
    if (!config || config._retry || !isRetryableError(error)) {
      return Promise.reject(error)
    }

    // Mark as retried
    config._retry = true

    // Retry with exponential backoff
    try {
      return await withRetry(() => client(config))
    } catch (retryError) {
      return Promise.reject(retryError)
    }
  }
)

export default client
