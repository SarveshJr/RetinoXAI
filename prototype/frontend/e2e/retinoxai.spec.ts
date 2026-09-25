import { test, expect, request as pwRequest } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const BAD_IMG = path.resolve(here, 'fixtures/not_fundus.png')
// A real, high-resolution fundus photo bundled in the app — expected to pass.
const GOOD_IMG = path.resolve(here, '../src/assets/fundus/grade0_normal_right.jpg')

test.describe('RetinoXAI clinician platform', () => {
  test('backend health endpoint is live', async () => {
    const api = await pwRequest.newContext()
    const res = await api.get('http://127.0.0.1:8080/api/health')
    expect(res.ok()).toBeTruthy()
    const json = await res.json()
    expect(json.status).toBe('online')
    expect(json.modelVersion).toContain('ensemble')
    await api.dispose()
  })

  test('dashboard loads and shows the live MATLAB engine badge', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/RetinoXAI/i)
    await expect(page.getByText('MATLAB engine')).toBeVisible()
    await expect(page.getByText('Screened', { exact: false }).first()).toBeVisible()
  })

  test('sidebar shows the grouped navigation', async ({ page }) => {
    await page.goto('/')
    for (const group of ['Clinical', 'AI System', 'System']) {
      await expect(page.getByText(group, { exact: true }).first()).toBeVisible()
    }
    // Note: the Worklist link's accessible name includes its flagged-count badge,
    // so match by substring (not exact).
    for (const link of ['Dashboard', 'New Screening', 'Worklist', 'Analytics', 'Pipeline', 'Model Performance', 'Settings']) {
      await expect(page.getByRole('link', { name: link }).first()).toBeVisible()
    }
  })

  test('main pages navigate', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Analytics' }).first().click()
    await expect(page).toHaveURL(/\/analytics$/)
    await page.getByRole('link', { name: 'Pipeline' }).first().click()
    await expect(page).toHaveURL(/\/pipeline$/)
    await page.getByRole('link', { name: 'Settings' }).first().click()
    await expect(page).toHaveURL(/\/settings$/)
    await page.getByRole('link', { name: 'Worklist' }).first().click()
    await expect(page).toHaveURL(/\/worklist$/)
  })

  test('Model Performance deep-links to the metrics section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Model Performance', exact: true }).click()
    await expect(page).toHaveURL(/\/pipeline#model-performance$/)
    await expect(page.getByText('Frozen configuration')).toBeVisible()
    await expect(page.getByText(/Sensitivity/i).first()).toBeVisible()
  })

  test('case review renders a REAL fundus across all four layers', async ({ page }) => {
    await page.goto('/worklist')
    await page.locator('tbody tr').first().click()
    await expect(page).toHaveURL(/\/case\//)

    // The four layer switchers are buttons styled as tabs.
    const layers = ['Original', 'Enhanced', 'Segmentation', 'Grad-CAM++']
    for (const name of layers) {
      await page.getByRole('button', { name }).click()
      const img = page.getByRole('img', { name: /Fundus/i }).first()
      await expect(img).toBeVisible()
      // The bundled real photos live under /assets/fundus/…
      await expect(img).toHaveAttribute('src', /fundus/i)
    }
    // Grad-CAM++ overlays a heatmap canvas on the real photo.
    await page.getByRole('button', { name: 'Grad-CAM++' }).click()
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('quality gate REJECTS a non-fundus image and blocks the pipeline', async ({ page }) => {
    await page.goto('/screening')
    await page.getByRole('tab', { name: 'Upload' }).click()
    await page.locator('input[type="file"]').setInputFiles(BAD_IMG)

    await expect(page.getByText('Image quality too low')).toBeVisible()
    await expect(page.getByText(/16$/).first()).toBeVisible() // "x/16" score
    await expect(page.getByText('Why it was rejected')).toBeVisible()
    await expect(page.getByRole('button', { name: /Recapture \/ upload another image/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Run screening pipeline/i })).toBeDisabled()
  })

  test('quality gate PASSES a real fundus and runs the pipeline end-to-end', async ({ page }) => {
    test.setTimeout(120_000) // live MATLAB inference can take ~15s
    await page.goto('/screening')
    await page.getByRole('tab', { name: 'Upload' }).click()
    await page.locator('input[type="file"]').setInputFiles(GOOD_IMG)

    await expect(page.getByText('Image quality passed')).toBeVisible()
    const runBtn = page.getByRole('button', { name: /Run screening pipeline/i })
    await expect(runBtn).toBeEnabled()
    await runBtn.click()

    // Pipeline runs (live backend or client fallback) and a result appears.
    await expect(page.getByRole('button', { name: /Open full case review/i })).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('FundaQ-8', { exact: true })).toBeVisible()
  })
})
