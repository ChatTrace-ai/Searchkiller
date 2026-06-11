import { test, expect } from '@playwright/test';

test.describe('Prediction homepage', () => {
  test('renders prediction search and the first 16 cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Searchkiller').first()).toBeVisible();
    await expect(page.locator('h1')).toContainText('Search anything you want to predict');
    await expect(page.getByLabel('Prediction question')).toBeVisible();
    await expect(page.locator('a[href^="/prediction/"]')).toHaveCount(16);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('moves between 16-card pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href^="/prediction/"]')).toHaveCount(16);
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.locator('a[href^="/prediction/"]')).toHaveCount(16);
    await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(page.locator('a[href="/prediction/mars-launch-2026"]')).toBeVisible();

    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.locator('a[href="/prediction/world-cup-2026"]')).toBeVisible();
  });

  test('opens a featured prediction detail', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/prediction/world-cup-2026"]').click();
    await page.waitForURL('/prediction/world-cup-2026');
    await expect(page.locator('h1')).toContainText('2026 FIFA World Cup');
    await expect(page.getByText('Reference sources')).toBeVisible();
    await expect(page.getByText('Analysis summary')).toBeVisible();
  });

  test('creates a custom prediction from search', async ({ page }) => {
    await page.goto('/');
    const input = page.getByLabel('Prediction question');
    await input.fill('Will the demo prediction finish successfully?');
    await page.getByRole('button', { name: 'Predict' }).click();
    await page.waitForURL(/\/prediction\/pred_/);
    await expect(page.locator('h1')).toContainText('Will the demo prediction finish successfully?', {
      timeout: 8_000,
    });
  });

  test('uses an English document language', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
