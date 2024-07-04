// @ts-check
import { defineConfig, devices } from '@playwright/test'

import configLib from './tests/serve/config.js'

const serverUrl = `http://${configLib.host}:${configLib.port}`

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run serve',
    reuseExistingServer: !process.env.CI,
    stderr: 'pipe',
    stdout: 'pipe'
  }
})
