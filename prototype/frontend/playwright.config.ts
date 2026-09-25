import { defineConfig } from '@playwright/test'

// E2E config for RetinoXAI. Runs against the already-running dev server
// (Vite on :5173, MATLAB backend proxied on :8080). Uses the system Edge
// browser via the msedge channel so no browser download is required.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    channel: 'msedge',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
