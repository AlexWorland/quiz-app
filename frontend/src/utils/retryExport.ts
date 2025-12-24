import { ExportFormat } from '@/api/endpoints'

export interface ExportRetryConfig {
  maxRetries: number
  baseDelayMs: number
  format: ExportFormat
  eventId: string
  eventTitle: string
}

export interface ExportRetryState {
  retryCount: number
  lastError?: string
  isRetrying: boolean
}

export const calculateBackoffDelay = (attempt: number, baseDelayMs: number = 1000): number => {
  return baseDelayMs * Math.pow(2, attempt - 1)
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const getExportFileName = (format: ExportFormat, eventTitle: string): string => {
  const extension = format === 'json' ? 'json' : 'csv'
  const sanitizedTitle = eventTitle.replace(/[^a-z0-9]/gi, '_')
  return `${sanitizedTitle}_results.${extension}`
}
