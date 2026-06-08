import { test, expect } from '@playwright/test';

test.describe('Homepage UI', () => {
  test('renders Searchkiller title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Searchkiller');
  });

  test('renders search input', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"], input[type="search"], input[placeholder]');
    await expect(input.first()).toBeVisible();
  });

  test('renders example keyword tags', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('clicking example tag navigates to /research', async ({ page }) => {
    await page.goto('/');
    const tag = page.locator('button').first();
    await tag.click();
    await page.waitForURL(/\/research\?q=/);
    expect(page.url()).toContain('/research?q=');
  });

  test('page has dark background', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });

  test('page lang is zh-CN', async ({ page }) => {
    await page.goto('/');
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('zh-CN');
  });
});
