import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, devices } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FRONTEND_DIR = path.resolve(__dirname, '..')
const WEB_PORT = Number(process.env.E2E2_WEB_PORT || '4174')
const WEB_HOST = process.env.E2E2_WEB_HOST || '0.0.0.0'
const BASE_URL = process.env.E2E2_BASE_URL || `http://127.0.0.1:${WEB_PORT}`
const MODE = process.env.E2E2_MODE || 'local'
const SHOULD_START_SERVER = process.env.E2E2_START_SERVER !== 'false' && MODE !== 'docker'
const WEB_COMMAND =
  process.env.E2E2_WEB_COMMAND ||
  `npm run dev -- --host ${WEB_HOST} --port ${WEB_PORT}`

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run all tests serially to avoid database contention and timing issues
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: SHOULD_START_SERVER
    ? {
        command: WEB_COMMAND,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        cwd: FRONTEND_DIR,
      }
    : undefined,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})

