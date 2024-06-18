// @ts-check
const { readdirSync } = require('node:fs')

const { test, expect } = require('@playwright/test')

const testCases = readdirSync('./tests/html').filter(x => x.endsWith('.html'))

for (const testCase of testCases) {
  const testCaseName = testCase.replace('.html', '')
  test(`${testCaseName}`, async ({ page }) => {
    await page.goto(testCase)
    test.setTimeout(120000)

    for (const aTarget of await page.locator('[data-expect=visible]').all()) {
      await expect(aTarget).toBeVisible()
    }

    for (const aTarget of await page.locator('[data-expect=hidden]').all()) {
      await expect(aTarget).toBeHidden()
    }
  })
}
