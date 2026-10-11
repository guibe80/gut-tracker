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
 * 5. Grouped navigation exposes every tracker section
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

test.describe('Grouped navigation', () => {
  test('all tab buttons exist within their groups', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const groups = ['log', 'gut-body', 'review', 'manage'];
    for (const group of groups) {
      await expect(page.locator(`.nav-group[data-nav-group="${group}"]`)).toHaveCount(1);
    }
    const tabs = ['food', 'fiveaday', 'glucose', 'symptoms', 'bowel', 'weight', 'water', 'timeline', 'dayview', 'insights', 'data'];
    for (const tab of tabs) {
      await expect(page.locator(`.tab[data-tab="${tab}"]`)).toHaveCount(1);
    }
  });

  test('the floating group bar opens its destination options and pane', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#app').evaluate(element => element.classList.remove('hidden'));

    await expect(page.locator('.floating-tab-bar')).toBeVisible();
    await page.locator('.floating-tab-bar .nav-group[data-nav-group="review"]').click();
    await expect(page.locator('#dayview')).toBeVisible();
    await expect(page.locator('.tab[data-tab="dayview"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.tab[data-tab="timeline"]')).toBeVisible();

    await page.locator('.floating-tab-bar .nav-group[data-nav-group="log"]').click();
    await page.locator('.tab[data-tab="glucose"]').click();
    await expect(page.locator('#glucose')).toBeVisible();
    await expect(page.locator('[data-quick-tab], [data-all-tab]')).toHaveCount(0);
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
