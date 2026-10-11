const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const calculatorCode = fs.readFileSync(
    path.resolve(__dirname, '../../utils/five-a-day-calculator.js'),
    'utf8'
);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(calculatorCode, sandbox);

describe('calculateFiveADayEntryPortions', () => {
    test('uses 80g portions for fruit and vegetables', () => {
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'fruit', quantity: 160, unit: 'g', confirmed: true }), 2);
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'vegetable', quantity: 40, unit: 'g', confirmed: true }), 0.5);
    });

    test('uses a 30g portion for dried fruit', () => {
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'dried_fruit', quantity: 30, unit: 'g', confirmed: true }), 1);
    });

    test('caps beans, and juice limits at the daily summary stage', () => {
        const summary = sandbox.summarizeFiveADayEntries([
            { id: 'beans-first', consumed_at: '2026-06-01T08:00:00Z', date: '2026-06-01', category: 'beans_pulses', quantity: 240, unit: 'g', confirmed: true },
            { id: 'beans-second', consumed_at: '2026-06-01T09:00:00Z', date: '2026-06-01', category: 'beans_pulses', quantity: 80, unit: 'g', confirmed: true },
            { id: 'juice-first', consumed_at: '2026-06-01T10:00:00Z', date: '2026-06-01', category: 'juice_smoothie', quantity: 75, unit: 'ml', confirmed: true },
            { id: 'juice-second', consumed_at: '2026-06-01T11:00:00Z', date: '2026-06-01', category: 'juice_smoothie', quantity: 150, unit: 'ml', confirmed: true },
        ], '2026-06-01');
        assert.equal(summary.byCategory.beans_pulses, 1);
        assert.equal(summary.byCategory.juice_smoothie, 1);
        assert.equal(summary.entryContributions['beans-first'], 1);
        assert.equal(summary.entryContributions['beans-second'], 0);
        assert.equal(summary.entryContributions['juice-first'], 0.5);
        assert.equal(summary.entryContributions['juice-second'], 0.5);
    });

    test('mixed dishes count only explicitly recorded qualifying produce weight', () => {
        assert.equal(sandbox.calculateFiveADayEntryPortions({
            category: 'mixed_dish', quantity: 500, qualifying_weight_g: 120, unit: 'g', confirmed: true,
        }), 1.5);
        assert.equal(sandbox.calculateFiveADayEntryPortions({
            category: 'mixed_dish', quantity: 500, unit: 'g', confirmed: true,
        }), 0);
    });

    test('does not count excluded foods, unconfirmed entries, or invalid quantities', () => {
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'excluded', quantity: 200, unit: 'g', confirmed: true }), 0);
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'fruit', quantity: 80, unit: 'g', confirmed: false }), 0);
        assert.equal(sandbox.calculateFiveADayEntryPortions({ category: 'fruit', quantity: -80, unit: 'g', confirmed: true }), 0);
    });
});

describe('summarizeFiveADayEntries', () => {
    test('filters by local date, excludes unconfirmed entries, and handles progress above five', () => {
        const summary = sandbox.summarizeFiveADayEntries([
            { date: '2026-06-01', category: 'fruit', quantity: 400, unit: 'g', confirmed: true },
            { date: '2026-06-01', category: 'vegetable', quantity: 80, unit: 'g', confirmed: true },
            { date: '2026-06-01', category: 'fruit', quantity: 240, unit: 'g', confirmed: false },
            { date: '2026-06-02', category: 'fruit', quantity: 800, unit: 'g', confirmed: true },
        ], '2026-06-01');
        assert.equal(summary.portions, 6);
        assert.equal(summary.remaining, 0);
        assert.equal(summary.reachedTarget, true);
        assert.equal(summary.pendingCount, 1);
    });

    test('requires explicit qualifying weights for mixed dishes', () => {
        const summary = sandbox.summarizeFiveADayEntries([
            { date: '2026-06-01', category: 'mixed_dish', quantity: 500, unit: 'g', confirmed: true },
        ], '2026-06-01');
        assert.equal(summary.portions, 0);
    });
});
