import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:   './tests',
  fullyParallel: false,       // E2E não deve rodar em paralelo (banco compartilhado)
  forbidOnly: !!process.env.CI,
  retries:   process.env.CI ? 2 : 0,
  workers:   1,
  reporter:  [['html', { outputFolder: 'playwright-report' }], ['list']],
  timeout:   30_000,

  use: {
    baseURL:       process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    actionTimeout: 10_000,
  },

  projects: [
    {
      name:    'chromium',
      use:     { ...devices['Desktop Chrome'] },
    },
    // Descomente para testar mobile
    // {
    //   name: 'Mobile Chrome',
    //   use:  { ...devices['Pixel 5'] },
    // },
  ],

  webServer: process.env.CI ? {
    command:           'npm start',
    url:               'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout:           60_000,
  } : undefined,
});
