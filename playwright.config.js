// @ts-check
const { defineConfig, devices } = require('@playwright/test')

const configLib = require('./config.js')

const serverUrl = `http://${configLib.host}:${configLib.port}`

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: serverUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
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
