const { test, expect } = require('@playwright/test');

test.describe('5 A Day tracker prototype', () => {
  test('waits for auth before loading and refreshes when the app session is ready', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#fiveADayMessage')).toBeEmpty();

    await page.evaluate(() => {
      fiveADayRepository = createFiveADayMemoryRepository();
      user = { id: 'test-user', email: 'test@example.com' };
      showApp();
    });

    await page.locator('.tab[data-tab="fiveaday"]').click();
    await expect(page.locator('#fiveADayMessage')).toBeEmpty();
    await expect(page.locator('.fiveaday-empty')).toBeVisible();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      document.querySelector('#app').classList.remove('hidden');
      document.querySelector('#auth').classList.add('hidden');
      fiveADayRepository = createFiveADayMemoryRepository();
    });
    await page.locator('.tab[data-tab="fiveaday"]').click();
  });

  test('supports confirmed manual logging, editing, date history, and deletion', async ({ page }) => {
    const today = await page.locator('#fiveADaySelectedDate').inputValue();
    await page.locator('#fiveADayFoodSearch').fill('Apple');
    await page.locator('#fiveADayFoodSearch').dispatchEvent('change');
    await page.locator('#fiveADayQuantity').fill('160');
    await page.locator('#fiveADaySave').click();

    const entry = page.locator('.fiveaday-entry');
    await expect(entry).toContainText('Awaiting confirmation');
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');
    await entry.locator('[data-fiveaday-confirm]').click();
    await expect(page.locator('#fiveADayCount')).toHaveText('2 of 5 portions');

    await entry.locator('[data-fiveaday-edit]').click();
    await page.locator('#fiveADayQuantity').fill('240');
    await page.locator('#fiveADaySave').click();
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');
    await expect(entry).toContainText('Awaiting confirmation');
    await entry.locator('[data-fiveaday-confirm]').click();
    await expect(page.locator('#fiveADayCount')).toHaveText('3 of 5 portions');

    const tomorrow = new Date(`${today}T12:00:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await page.locator('#fiveADaySelectedDate').fill(tomorrowKey);
    await page.locator('#fiveADaySelectedDate').dispatchEvent('change');
    await expect(page.locator('.fiveaday-empty')).toBeVisible();
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');

    await page.locator('#fiveADaySelectedDate').fill(today);
    await page.locator('#fiveADaySelectedDate').dispatchEvent('change');
    await expect(page.locator('.fiveaday-entry')).toContainText('Confirmed · 3 portions');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-fiveaday-delete]').click();
    await expect(page.locator('.fiveaday-empty')).toBeVisible();
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');
  });

  test('requires known produce weight for mixed dishes and does not infer from total dish weight', async ({ page }) => {
    await page.locator('#fiveADayFoodSearch').fill('Vegetable casserole');
    await page.locator('#fiveADayCategory').selectOption('mixed_dish');
    await page.locator('#fiveADayQuantity').fill('500');
    await page.locator('#fiveADayEntryDate').fill(await page.locator('#fiveADaySelectedDate').inputValue());
    await page.locator('#fiveADayTime').fill('12:00');
    await page.locator('#fiveADayQualifyingWeight').fill('100');
    await page.locator('#fiveADaySave').click();
    const entry = page.locator('.fiveaday-entry');
    await expect(entry).toContainText('Manual estimate');
    await expect(entry).toContainText('Awaiting confirmation');
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');
    await entry.locator('[data-fiveaday-confirm]').click();
    await expect(entry).toContainText('Confirmed · 1.25 portions');
    await expect(page.locator('#fiveADayCount')).toHaveText('1.25 of 5 portions');
  });

  test('keeps progress accessible and disables animation for reduced motion on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const progress = page.locator('#fiveADayProgress');
    await expect(progress).toHaveAttribute('role', 'progressbar');
    await expect(progress).toHaveAttribute('aria-valuetext', '0 of 5 portions');

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      transition: getComputedStyle(document.querySelector('#fiveADayProgressFill')).transitionDuration,
    }));
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.transition).toBe('0s');
  });

  test('keeps excluded catalogue foods in their NHS category', async ({ page }) => {
    await page.locator('#fiveADayFoodSearch').fill('Potato');
    await page.locator('#fiveADayFoodSearch').dispatchEvent('change');
    await expect(page.locator('#fiveADayCategory')).toHaveValue('excluded');
    await expect(page.locator('#fiveADayCategory')).toBeDisabled();
    await page.locator('#fiveADaySave').click();
    const entry = page.locator('.fiveaday-entry');
    await entry.locator('[data-fiveaday-confirm]').click();
    await expect(entry).toContainText('Confirmed · 0 portions');
    await expect(page.locator('#fiveADayCount')).toHaveText('0 of 5 portions');
  });
});
