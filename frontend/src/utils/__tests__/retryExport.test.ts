import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateBackoffDelay, sleep, getExportFileName } from '../retryExport'

describe('retryExport utilities', () => {
  describe('calculateBackoffDelay', () => {
    it('calculates exponential backoff delays correctly', () => {
      expect(calculateBackoffDelay(1, 1000)).toBe(1000)
      expect(calculateBackoffDelay(2, 1000)).toBe(2000)
      expect(calculateBackoffDelay(3, 1000)).toBe(4000)
      expect(calculateBackoffDelay(4, 1000)).toBe(8000)
    })

    it('works with custom base delay', () => {
      expect(calculateBackoffDelay(1, 500)).toBe(500)
      expect(calculateBackoffDelay(2, 500)).toBe(1000)
      expect(calculateBackoffDelay(3, 500)).toBe(2000)
    })

    it('uses default 1000ms base delay when not specified', () => {
      expect(calculateBackoffDelay(1)).toBe(1000)
      expect(calculateBackoffDelay(2)).toBe(2000)
    })
  })

  describe('sleep', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('resolves after specified milliseconds', async () => {
      const promise = sleep(1000)
      expect(promise).toBeTruthy()

      vi.advanceTimersByTime(1000)
      await promise

      expect(vi.getTimerCount()).toBe(0)
    })

    it('can be canceled by advancing timers', async () => {
      const callback = vi.fn()
      sleep(500).then(callback)

      vi.advanceTimersByTime(500)
      await Promise.resolve()

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('getExportFileName', () => {
    it('generates JSON filename correctly', () => {
      const filename = getExportFileName('json', 'My Event')
      expect(filename).toBe('My_Event_results.json')
    })

    it('generates CSV filename correctly', () => {
      const filename = getExportFileName('csv', 'Quiz Results')
      expect(filename).toBe('Quiz_Results_results.csv')
    })

    it('sanitizes special characters', () => {
      const filename = getExportFileName('json', 'Event@2024! #Quiz')
      expect(filename).toBe('Event_2024___Quiz_results.json')
    })

    it('handles titles with numbers', () => {
      const filename = getExportFileName('json', 'Q1 2024 Sales')
      expect(filename).toBe('Q1_2024_Sales_results.json')
    })

    it('handles empty title', () => {
      const filename = getExportFileName('json', '')
      expect(filename).toBe('_results.json')
    })
  })
})
