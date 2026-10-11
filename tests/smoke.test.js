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

test.describe('Responsive date controls', () => {
  test('date controls stay within their cards at supported viewport widths', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#auth').evaluate(element => element.classList.add('hidden'));
    await page.locator('#app').evaluate(element => element.classList.remove('hidden'));

    const widths = [320, 360, 390, 430, 768, 1024, 1280];
    const controls = [
      { tab: 'water', selector: '#water .section-title > .row', card: '#water .card' },
      { tab: 'fiveaday', selector: '.fiveaday-date', card: '#fiveaday .card' },
      { tab: 'dayview', selector: '.dv-date', card: '#dayview .card' },
    ];

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });

      for (const control of controls) {
        await page.evaluate(tab => openTab(tab), control.tab);
        if (width === 320 && control.tab === 'fiveaday') {
          await expect(page.locator('#fiveADaySelectedDate')).toHaveAccessibleName('Selected day');
        }
        const layout = await page.locator(control.selector).evaluate((container, cardSelector) => {
          const rect = element => {
            const bounds = element.getBoundingClientRect();
            return {
              left: bounds.left,
              right: bounds.right,
              top: bounds.top,
              bottom: bounds.bottom,
            };
          };
          const containerBounds = rect(container);
          const cardBounds = rect(document.querySelector(cardSelector));
          const children = [...container.querySelectorAll('button, input')].map(rect);
          return {
            container: containerBounds,
            card: cardBounds,
            children,
            documentWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth,
          };
        }, control.card);

        expect(layout.container.left, `${control.tab} left edge at ${width}px`).toBeGreaterThanOrEqual(layout.card.left);
        expect(layout.container.right, `${control.tab} right edge at ${width}px`).toBeLessThanOrEqual(layout.card.right + 1);
        expect(layout.children.length, `${control.tab} control count`).toBe(4);
        for (const child of layout.children) {
          expect(child.left, `${control.tab} control left edge at ${width}px`).toBeGreaterThanOrEqual(layout.container.left);
          expect(child.right, `${control.tab} control right edge at ${width}px`).toBeLessThanOrEqual(layout.container.right + 1);
        }
        expect(layout.children[0].top, `${control.tab} previous/date/next alignment at ${width}px`)
          .toBeCloseTo(layout.children[1].top, 0);
        expect(layout.children[1].top, `${control.tab} date/next alignment at ${width}px`)
          .toBeCloseTo(layout.children[2].top, 0);
        if (width <= 320) {
          expect(layout.children[3].top, `${control.tab} Today placement at ${width}px`)
            .toBeGreaterThan(layout.children[0].top);
        } else {
          expect(layout.children[3].top, `${control.tab} Today placement at ${width}px`)
            .toBeCloseTo(layout.children[0].top, 0);
        }
        expect(layout.documentWidth, `page horizontal overflow at ${width}px`)
          .toBeLessThanOrEqual(layout.viewportWidth);
      }
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
