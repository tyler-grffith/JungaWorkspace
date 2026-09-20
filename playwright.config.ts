import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: /designer.spec.ts/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'designer',
      testMatch: /designer.spec.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4174' },
    },
  ],
  webServer: [
    {
      command: 'npm run build && npm run preview',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -- --port 4174',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
      env: { JUNGA_DESIGN_TEST: '1' },
    },
  ],
})
