const { test, expect } = require('@playwright/test');

const versionPattern = /V\d+\.\d+\.\d+/i;

/**
 * Browser smoke tests for Gut + Glucose Tracker
 *
 * Critical flows covered:
 * 1. App loads and displays correct title + version
 * 2. Auth screen visible when not signed in
 * 3. Setup link visible on auth screen
 * 4. Service worker registers
 * 5. All navigation tab buttons exist
 * 6. PWA manifest is valid
 * 7. Setup page loads with key input
 *
 * Requirements:
 *   - Playwright installed:  cd tests && npm install && npx playwright install
 *   - Run:                   cd tests && npm test
 *
 * The app server is started automatically by the Playwright config (port 8080).
 */

test.describe('App loads', () => {
  test('index page has correct title and version', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(new RegExp(`Gut \\+ Glucose Tracker ${versionPattern.source}`, 'i'));
  });

  test('auth screen is visible when not logged in', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#auth')).toBeVisible();
    await expect(page.locator('#app')).toHaveClass(/hidden/);
  });

  test('version is displayed in footer', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-app-version]')).toHaveText(versionPattern);
  });

  test('setup link is visible on auth screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#setupLink')).toBeVisible();
  });
});

test.describe('Setup page', () => {
  test('setup.html loads with key input', async ({ page }) => {
    await page.goto('/setup.html');
    await page.waitForLoadState('networkidle');
    const keyInput = page.locator('#key');
    await expect(keyInput).toBeVisible();
    await expect(keyInput).toHaveAttribute('type', 'password');
  });

  test('setup page shows version', async ({ page }) => {
    await page.goto('/setup.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-app-version]')).toHaveText(versionPattern);
  });
});

test.describe('Service worker', () => {
  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const swScope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg ? reg.scope : null;
    });
    expect(swScope).not.toBeNull();
  });
});

test.describe('Navigation tabs', () => {
  test('all tab buttons exist', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const tabs = ['food', 'glucose', 'symptoms', 'bowel', 'weight', 'water', 'timeline', 'dayview', 'insights', 'data'];
    for (const tab of tabs) {
      await expect(page.locator(`.tab[data-tab="${tab}"]`)).toHaveCount(1);
    }
  });
});

test.describe('PWA manifest', () => {
  test('manifest is valid JSON with required fields', async ({ page }) => {
    const response = await page.request.get('/manifest.webmanifest');
    const manifest = await response.json();
    expect(manifest.name).toContain('Gut');
    expect(manifest.short_name).toBeDefined();
    expect(manifest.start_url).toBeDefined();
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });
});
