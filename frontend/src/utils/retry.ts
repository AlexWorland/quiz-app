interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  retryableStatuses: number[]
}

const defaultConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, retryableStatuses } = {
    ...defaultConfig,
    ...config,
  }

  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      const status = error.response?.status
      const isRetryable = !status || retryableStatuses.includes(status)

      if (!isRetryable || attempt === maxRetries) {
        throw error
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

export function isRetryableError(error: any): boolean {
  const status = error.response?.status
  return !status || [408, 429, 500, 502, 503, 504].includes(status)
}

