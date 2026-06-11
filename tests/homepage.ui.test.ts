import { test, expect } from '@playwright/test';

test.describe('Prediction homepage', () => {
  test('renders prediction search and the first 16 cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Searchkiller').first()).toBeVisible();
    await expect(page.locator('h1')).toContainText('Search anything you want to predict');
    await expect(page.getByLabel('Prediction question')).toBeVisible();
    await expect(page.getByLabel('Prediction question')).toHaveCount(1);
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

  test('does not flash generation progress before a completed prediction loads', async ({ page }) => {
    let releaseResponse: (() => void) | undefined;
    const responseReady = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route('**/api/predictions/world-cup-2026', async (route) => {
      await responseReady;
      await route.continue();
    });

    await page.goto('/prediction/world-cup-2026', { waitUntil: 'commit' });
    await expect(page.getByLabel('Loading prediction')).toBeVisible();
    await expect(page.getByText('Forecast in progress')).toHaveCount(0);

    releaseResponse?.();

    await expect(page.locator('h1')).toContainText('2026 FIFA World Cup');
    await expect(page.getByText('Forecast in progress')).toHaveCount(0);
  });

  test('keeps long detail sources and reports inside scrollable panels', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.route('**/api/predictions/pred_long_detail', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pred_long_detail',
          question: 'Will the long prediction detail remain usable?',
          category: 'Technology',
          status: 'completed',
          confidence: {
            level: 'high',
            score: 82,
            explanation: 'Multiple independent sources support the forecast.',
          },
          outcomes: Array.from({ length: 8 }, (_, index) => ({
            id: `outcome-${index}`,
            rank: index + 1,
            label: `Outcome ${index + 1}`,
            probability: 20 - index,
            change: 0,
            rationale: 'Supported by the collected evidence.',
            sourceIds: [`source-${index}`],
          })),
          sources: Array.from({ length: 12 }, (_, index) => ({
            id: `source-${index}`,
            title: `Reference source ${index + 1}`,
            description: 'Detailed evidence collected for this prediction.',
            url: `https://example.com/source-${index}`,
            quality: 'high',
          })),
          summary: Array.from(
            { length: 8 },
            (_, index) => `Analysis point ${index + 1} explains an important forecast signal.`,
          ),
          report: Array.from(
            { length: 12 },
            (_, index) => `## Report section ${index + 1}\n\nDetailed analysis for this section.`,
          ).join('\n\n'),
          createdAt: '2026-06-11T10:00:00Z',
          updatedAt: '2026-06-11T10:05:00Z',
        }),
      });
    });

    await page.goto('/prediction/pred_long_detail');
    await expect(page.getByRole('heading', { name: 'Analysis report' })).toBeVisible();

    for (const testId of ['detail-sources-panel', 'detail-report-panel']) {
      expect(await page.getByTestId(testId).evaluate((element) => (
        element.scrollHeight > element.clientHeight
      ))).toBe(true);
    }
    expect(await page.evaluate(() => (
      getComputedStyle(document.body.firstElementChild as Element).overflowY !== 'hidden'
    ))).toBe(true);
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

  test('renders the complete Mock stream while polling stays processing', async ({ page }) => {
    await page.clock.install();
    await page.route('**/api/predictions/pred_progress_demo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pred_progress_demo',
          question: 'Will the multilingual launch ship this month?',
          status: 'processing',
          progress: {
            stage: 'estimating',
            message: 'Analyzing sources and estimating probabilities',
          },
          updatedAt: '2026-06-11T10:00:00Z',
        }),
      });
    });

    await page.goto('/prediction/pred_progress_demo');

    await expect(page.getByRole('heading', {
      name: 'Will the multilingual launch ship this month?',
    })).toBeVisible();
    await expect(page.getByText('Preview', { exact: true })).toBeVisible();

    await page.clock.fastForward(13_000);

    await expect(page.locator('#prediction-progress-heading')).toHaveText('Writing the report');
    await expect(page.getByRole('heading', { name: 'Search queries' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reference sources' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Draft probabilities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analysis report' })).toBeVisible();
    await expect(page.getByText('Leading outcome', { exact: true })).toBeVisible();
    await expect(page.getByText('Preliminary assessment')).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '90');
    await expect(page.getByText('Elapsed')).toBeVisible();
    await expect(page.getByText('Step')).toBeVisible();

    const streamPanel = page.getByTestId('prediction-stream-panel');
    expect(await streamPanel.evaluate((element) => (
      element.scrollHeight > element.clientHeight
    ))).toBe(true);
    await expect.poll(async () => streamPanel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThan(2);
    expect(await page.evaluate(() => (
      document.documentElement.scrollHeight <= window.innerHeight
    ))).toBe(true);
  });

  test('uses polling as final authority and switches to completed detail', async ({ page }) => {
    await page.clock.install();
    let requestCount = 0;

    await page.route('**/api/predictions/pred_poll_complete', async (route) => {
      requestCount += 1;
      if (requestCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pred_poll_complete',
            question: 'Will polling publish the final result?',
            status: 'processing',
            progress: {
              stage: 'planning',
              message: 'Planning focused research queries',
            },
            updatedAt: '2026-06-11T10:00:00Z',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pred_poll_complete',
          question: 'Will polling publish the final result?',
          category: 'General',
          status: 'completed',
          confidence: {
            level: 'medium',
            score: 65,
            explanation: 'The final response came from the detail endpoint.',
          },
          outcomes: [
            {
              id: 'yes',
              rank: 1,
              label: 'Yes',
              probability: 65,
              change: 0,
              rationale: 'Polling returned the completed prediction.',
              sourceIds: [],
            },
            {
              id: 'no',
              rank: 2,
              label: 'No',
              probability: 35,
              change: 0,
              rationale: 'The alternative remains possible.',
              sourceIds: [],
            },
          ],
          sources: [],
          summary: ['Polling remains the final source of truth.'],
          report: '## Final result\n\nThe completed detail replaced the stream preview.',
          createdAt: '2026-06-11T10:00:00Z',
          updatedAt: '2026-06-11T10:00:02Z',
        }),
      });
    });

    await page.goto('/prediction/pred_poll_complete');
    await expect(page.getByText('Forecast in progress')).toBeVisible();

    await page.clock.fastForward(2_100);

    await expect(page.getByText('Analysis summary')).toBeVisible();
    await expect(page.getByText('Polling remains the final source of truth.')).toBeVisible();
    await expect(page.getByText('Forecast in progress')).toHaveCount(0);
  });

  test('keeps the completed Mock stream readable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.install();
    await page.route('**/api/predictions/pred_mobile_stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pred_mobile_stream',
          question: 'Will the mobile prediction stream remain readable?',
          status: 'processing',
          progress: {
            stage: 'planning',
            message: 'Planning focused research queries',
          },
          updatedAt: '2026-06-11T10:00:00Z',
        }),
      });
    });

    await page.goto('/prediction/pred_mobile_stream');
    await expect(page.getByRole('heading', {
      name: 'Will the mobile prediction stream remain readable?',
    })).toBeVisible();
    await page.clock.fastForward(1_500);
    await expect(page.getByRole('heading', { name: 'Search queries' })).toBeVisible();
    await page.clock.fastForward(12_000);

    await expect(page.getByRole('heading', { name: 'Draft probabilities' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analysis report' })).toBeVisible();
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    expect(await page.evaluate(() => (
      document.documentElement.scrollHeight <= window.innerHeight
    ))).toBe(true);
    expect(await page.getByTestId('prediction-stream-panel').evaluate((element) => (
      element.scrollHeight > element.clientHeight
    ))).toBe(true);
  });
});
