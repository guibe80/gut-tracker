// E2E tests for the Water Intake feature
// Run: cd tests && npx playwright test water.test.js
//
// These tests bypass the auth flow by injecting a mock user,
// then exercise the water tab's UI and interactions.

const { test, expect } = require('@playwright/test');

test.describe('Water intake', () => {

    // Helper: bypass auth and show the app so we can interact with the water tab
    async function setupWaterTab(page) {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => {
            user = { id: 'test-user', email: 'test@test.com' };
            showApp();
            render();
        });
        await page.click('.tab[data-tab="water"]');
        await page.waitForTimeout(100);
    }

    test('water starts at 0 ml', async ({ page }) => {
        await setupWaterTab(page);
        await expect(page.locator('#waterConsumed')).toHaveText('0');
        await expect(page.locator('#waterPct')).toHaveText('0%');
        const fillPct = await page.locator('#waterFill').evaluate(
            el => el.style.getPropertyValue('--water-fill-pct')
        );
        expect(fillPct).toBe('0%');
    });

    test('+250ml increases total by exactly 250 ml', async ({ page }) => {
        await setupWaterTab(page);
        await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('250');
    });

    test('+500ml increases total by exactly 500 ml', async ({ page }) => {
        await setupWaterTab(page);
        await page.click('#waterAdd500');
        await expect(page.locator('#waterConsumed')).toHaveText('500');
    });

    test('clicking +250ml twice gives 500 ml total', async ({ page }) => {
        await setupWaterTab(page);
        await page.click('#waterAdd250');
        await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('500');
    });

    test('bottle fill level updates correctly after +250ml', async ({ page }) => {
        await setupWaterTab(page);
        // Default target with no weight data: 2000 ml
        await page.click('#waterAdd250');
        // 250 / 2000 = 12.5% → rounds to 13%
        const fillPct = await page.locator('#waterFill').evaluate(
            el => el.style.getPropertyValue('--water-fill-pct')
        );
        expect(fillPct).toBe('13%');
    });

    test('progress percentage updates correctly', async ({ page }) => {
        await setupWaterTab(page);
        // Add 4 × 250ml = 1000ml → 50% of 2000ml
        for (let i = 0; i < 4; i++) await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('1,000');
        await expect(page.locator('#waterPct')).toHaveText('50%');
    });

    test('progress handles exactly 100% correctly', async ({ page }) => {
        await setupWaterTab(page);
        // Add 8 × 250ml = 2000ml → 100% of 2000ml
        for (let i = 0; i < 8; i++) await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('2,000');
        await expect(page.locator('#waterPct')).toHaveText('100%');
        const fillPct = await page.locator('#waterFill').evaluate(
            el => el.style.getPropertyValue('--water-fill-pct')
        );
        // Fill should be capped at 100%
        expect(fillPct).toBe('100%');
    });

    test('progress handles values above target correctly', async ({ page }) => {
        await setupWaterTab(page);
        // Add 10 × 250ml = 2500ml → 125% of 2000ml
        for (let i = 0; i < 10; i++) await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('2,500');
        await expect(page.locator('#waterPct')).toHaveText('125%');
        // Bottle fill capped at 100%
        const fillPct = await page.locator('#waterFill').evaluate(
            el => el.style.getPropertyValue('--water-fill-pct')
        );
        expect(fillPct).toBe('100%');
    });

    test('personalised target is calculated from latest weight', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => {
            // 70 kg → 30 × 70 = 2100 ml
            weights = [{ weight_kg: 70, measured_at: new Date().toISOString() }];
            user = { id: 'test-user', email: 'test@test.com' };
            showApp();
            render();
        });
        await page.click('.tab[data-tab="water"]');
        await page.waitForTimeout(100);
        await expect(page.locator('#waterTarget')).toHaveText('2,100');
        await expect(page.locator('#waterTargetL')).toHaveText('2.1');
    });

    test('default target shown when no weight data available', async ({ page }) => {
        await setupWaterTab(page);
        await expect(page.locator('#waterTarget')).toHaveText('2,000');
        await expect(page.locator('#waterTargetL')).toHaveText('2.0');
        await expect(page.locator('#waterTargetNote')).toHaveText(
            '(general recommendation)'
        );
    });

    test('target note shows "from last weigh-in" when weight is available', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => {
            weights = [{ weight_kg: 65, measured_at: new Date().toISOString() }];
            user = { id: 'test-user', email: 'test@test.com' };
            showApp();
            render();
        });
        await page.click('.tab[data-tab="water"]');
        await page.waitForTimeout(100);
        await expect(page.locator('#waterTargetNote')).toHaveText(
            '(from last weigh-in)'
        );
    });

    test('recording water through the meal/drink workflow updates the tracker', async ({ page }) => {
        await setupWaterTab(page);
        // Simulate the meal/drink integration directly
        await page.evaluate(() => {
            // addWaterFromMeal parses "250ml water" from the foods text
            addWaterFromMeal('test-meal-1', '250ml water, chicken');
            renderWaterIntake();
        });
        await expect(page.locator('#waterConsumed')).toHaveText('250');
        await expect(page.locator('#waterPct')).toHaveText('13%');
        // Verify the entry is shown as "from meal"
        const entriesText = await page.locator('#waterEntries').textContent();
        expect(entriesText).toContain('from meal');
    });

    test('water is not counted twice for the same meal', async ({ page }) => {
        await setupWaterTab(page);
        await page.evaluate(() => {
            // Simulate saving the same drink meal twice (e.g., editing)
            addWaterFromMeal('test-meal-2', '250ml water');
            addWaterFromMeal('test-meal-2', '500ml water');  // update → should replace, not add
            renderWaterIntake();
        });
        // Should be 500ml (the latest), not 750ml (duplicate)
        await expect(page.locator('#waterConsumed')).toHaveText('500');
    });

    test('different drink volumes are parsed correctly', async ({ page }) => {
        await setupWaterTab(page);
        await page.evaluate(() => {
            addWaterFromMeal('test-meal-3', '500ml agua, leche');
            renderWaterIntake();
        });
        await expect(page.locator('#waterConsumed')).toHaveText('500');
    });

    test('non-water drinks do not add water', async ({ page }) => {
        await setupWaterTab(page);
        await page.evaluate(() => {
            addWaterFromMeal('test-meal-4', '250ml juice only');
            renderWaterIntake();
        });
        await expect(page.locator('#waterConsumed')).toHaveText('0');
    });

    test('deleting a water entry decreases the total', async ({ page }) => {
        await setupWaterTab(page);
        await page.click('#waterAdd250');
        await page.click('#waterAdd250');  // 500ml now
        await expect(page.locator('#waterConsumed')).toHaveText('500');
        // Delete first entry
        const firstDeleteBtn = await page.$('.entry-delete');
        if (firstDeleteBtn) await firstDeleteBtn.click();
        await expect(page.locator('#waterConsumed')).toHaveText('250');
    });

    test('changing dates does not mix water from different days', async ({ page }) => {
        await setupWaterTab(page);
        // Add water for today
        await page.click('#waterAdd250');
        await expect(page.locator('#waterConsumed')).toHaveText('250');

        // Navigate to a different date — should show 0 for that date
        await page.click('#waterNextDay');
        await page.waitForTimeout(100);
        await expect(page.locator('#waterConsumed')).toHaveText('0');

        // Navigate back — should show 250 again
        await page.click('#waterPrevDay');
        await page.waitForTimeout(100);
        await expect(page.locator('#waterConsumed')).toHaveText('250');
    });

    test('today button returns to current day', async ({ page }) => {
        await setupWaterTab(page);
        await page.click('#waterNextDay');
        await page.waitForTimeout(100);
        await page.click('#waterToday');
        await page.waitForTimeout(100);
        const todayKey = await page.evaluate(() => getDateKey());
        const dateInputVal = await page.locator('#waterDate').inputValue();
        expect(dateInputVal).toBe(todayKey);
    });

    test('date input allows manual date selection', async ({ page }) => {
        await setupWaterTab(page);
        // Pick a date 3 days ago
        const threeDaysAgo = await page.evaluate(() => {
            const d = new Date();
            d.setDate(d.getDate() - 3);
            return dvFormatDate(d);
        });
        await page.locator('#waterDate').fill(threeDaysAgo);
        await page.waitForTimeout(100);
        await expect(page.locator('#waterConsumed')).toHaveText('0');
    });
});
