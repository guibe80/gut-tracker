// Unit tests for ui/water-intake.js
// Run: node --test tests/unit/water-intake.test.js
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load water-intake.js + datetime.js (dependencies) in a vm sandbox.
// datetime.js provides: dvFormatDate
// water-intake.js provides: calculateWaterTarget, parseDrinkVolume, getDateKey,
//   getWaterStorage, saveWaterStorage, getWaterEntries, getWaterTotal,
//   addWaterEntry, removeWaterEntry, addWaterFromMeal, removeWaterFromMeal

const datetimeCode = fs.readFileSync(
    path.resolve(__dirname, '../../utils/datetime.js'),
    'utf8'
);

const waterCode = fs.readFileSync(
    path.resolve(__dirname, '../../ui/water-intake.js'),
    'utf8'
);

const sandbox = {
    localStorage: {
        _store: {},
        getItem(key) { return this._store[key] || null },
        setItem(key, val) { this._store[key] = val },
        removeItem(key) { delete this._store[key] }
    },
    _clearStorage() { this.localStorage._store = {} }
};
vm.createContext(sandbox);
vm.runInContext(datetimeCode, sandbox);
vm.runInContext(waterCode, sandbox);

const {
    calculateWaterTarget,
    parseDrinkVolume,
    getDateKey,
    getWaterStorage,
    saveWaterStorage,
    getWaterEntries,
    getWaterTotal,
    addWaterEntry,
    removeWaterEntry,
    addWaterFromMeal,
    removeWaterFromMeal,
    DEFAULT_WATER_TARGET_ML,
    WATER_ENTRY_STEP_ML
} = sandbox;

/* ------------------------------------------------------------------ */

describe('calculateWaterTarget', () => {
    test('returns 2000 ml by default when no weight', () => {
        assert.strictEqual(calculateWaterTarget(null), 2000);
        assert.strictEqual(calculateWaterTarget(undefined), 2000);
        assert.strictEqual(calculateWaterTarget(NaN), 2000);
    });

    test('calculates 30 ml per kg, rounded to nearest 50', () => {
        assert.strictEqual(calculateWaterTarget(70), 2100);  // 30×70=2100
        assert.strictEqual(calculateWaterTarget(60), 1800);  // 30×60=1800
        assert.strictEqual(calculateWaterTarget(80), 2400);  // 30×80=2400
    });

    test('minimum target is 1500 ml', () => {
        // 30 × 20kg = 600 → clamped to 1500
        assert.strictEqual(calculateWaterTarget(20), 1500);
        // 30 × 40kg = 1200 → clamped to 1500
        assert.strictEqual(calculateWaterTarget(40), 1500);
    });

    test('accepts numeric string weight', () => {
        assert.strictEqual(calculateWaterTarget('70'), 2100);
    });

    test('handles zero and negative weights', () => {
        assert.strictEqual(calculateWaterTarget(0), 1500);
        assert.strictEqual(calculateWaterTarget(-5), 1500);
    });
});

describe('parseDrinkVolume', () => {
    test('parses "250ml water"', () => {
        assert.strictEqual(parseDrinkVolume('250ml water'), 250);
    });

    test('parses "500 ml water"', () => {
        assert.strictEqual(parseDrinkVolume('500 ml water'), 500);
    });

    test('parses "1l water"', () => {
        assert.strictEqual(parseDrinkVolume('1l water'), 1000);
    });

    test('parses "2 l water"', () => {
        assert.strictEqual(parseDrinkVolume('2 l water'), 2000);
    });

    test('parses "8oz water"', () => {
        assert.strictEqual(parseDrinkVolume('8oz water'), 237);  // 8 * 29.5735 ≈ 236.59 → 237
    });

    test('parses volume after water mention', () => {
        assert.strictEqual(parseDrinkVolume('water 250ml'), 250);
    });

    test('parses "agua 500ml"', () => {
        assert.strictEqual(parseDrinkVolume('agua 500ml'), 500);
    });

    test('parses water volume in a mixed foods description', () => {
        assert.strictEqual(parseDrinkVolume('250ml water, 200ml juice'), 250);
    });

    test('returns null when no water mentioned', () => {
        assert.strictEqual(parseDrinkVolume('250ml juice'), null);
        assert.strictEqual(parseDrinkVolume('500ml coffee'), null);
    });

    test('returns null when water mentioned but no volume', () => {
        assert.strictEqual(parseDrinkVolume('just water'), null);
    });

    test('returns null for empty/null/undefined', () => {
        assert.strictEqual(parseDrinkVolume(''), null);
        assert.strictEqual(parseDrinkVolume(null), null);
        assert.strictEqual(parseDrinkVolume(undefined), null);
    });

    test('parses decimal volume', () => {
        assert.strictEqual(parseDrinkVolume('1.5l water'), 1500);
    });

    test('ignores volume far from water mention', () => {
        // Volume is >30 chars from "water" — should return null
        assert.strictEqual(parseDrinkVolume('water and then some other stuff here that is very long 500ml'), null);
    });
});

describe('getDateKey', () => {
    test('returns YYYY-MM-DD format', () => {
        const key = getDateKey(new Date(2025, 5, 15));
        assert.ok(key.match(/^\d{4}-\d{2}-\d{2}$/));
        assert.strictEqual(key, '2025-06-15');
    });
});

describe('Water entry storage', () => {
    beforeEach(() => sandbox._clearStorage());

    test('starts empty', () => {
        const data = getWaterStorage();
        assert.strictEqual(Object.keys(data).length, 0);
    });

    test('addWaterEntry stores entry by date key', () => {
        addWaterEntry('2025-06-15', 250, 'manual');
        const entries = getWaterEntries('2025-06-15');
        assert.strictEqual(entries.length, 1);
        assert.strictEqual(entries[0].amountMl, 250);
        assert.strictEqual(entries[0].source, 'manual');
    });

    test('getWaterTotal sums all entries', () => {
        addWaterEntry('2025-06-15', 250, 'manual');
        addWaterEntry('2025-06-15', 250, 'manual');
        assert.strictEqual(getWaterTotal('2025-06-15'), 500);
    });

    test('entries from different dates are separate', () => {
        addWaterEntry('2025-06-15', 250, 'manual');
        addWaterEntry('2025-06-16', 250, 'manual');
        assert.strictEqual(getWaterTotal('2025-06-15'), 250);
        assert.strictEqual(getWaterTotal('2025-06-16'), 250);
    });

    test('removeWaterEntry deletes by ID', () => {
        const entry = addWaterEntry('2025-06-15', 250, 'manual');
        assert.strictEqual(getWaterTotal('2025-06-15'), 250);
        removeWaterEntry('2025-06-15', entry.id);
        assert.strictEqual(getWaterTotal('2025-06-15'), 0);
    });

    test('manual and meal entries both count', () => {
        addWaterEntry('2025-06-15', 250, 'manual');
        addWaterEntry('2025-06-15', 500, 'meal', 'meal-abc-123');
        assert.strictEqual(getWaterTotal('2025-06-15'), 750);
    });

    test('updating a meal entry replaces, does not duplicate', () => {
        addWaterEntry('2025-06-15', 250, 'meal', 'meal-abc');
        addWaterEntry('2025-06-15', 500, 'meal', 'meal-abc');
        assert.strictEqual(getWaterTotal('2025-06-15'), 500);  // should be 500, not 750
    });

    test('removeWaterFromMeal removes all entries for a meal', () => {
        addWaterEntry('2025-06-15', 250, 'meal', 'meal-xyz');
        addWaterEntry('2025-06-15', 250, 'manual');
        addWaterEntry('2025-06-16', 500, 'meal', 'meal-xyz');
        removeWaterFromMeal('meal-xyz');
        assert.strictEqual(getWaterTotal('2025-06-15'), 250);  // only manual remains
        assert.strictEqual(getWaterTotal('2025-06-16'), 0);
    });
});

describe('addWaterFromMeal', () => {
    beforeEach(() => sandbox._clearStorage());

    test('adds water entry when foods contain water volume', () => {
        const result = addWaterFromMeal('meal-1', '250ml water, juice');
        assert.strictEqual(result, 250);
        const entries = getWaterEntries(getDateKey(new Date()));
        const mealEntry = entries.find(e => e.source === 'meal' && e.mealId === 'meal-1');
        assert.ok(mealEntry);
        assert.strictEqual(mealEntry.amountMl, 250);
    });

    test('returns null when no water in foods', () => {
        const result = addWaterFromMeal('meal-2', '500ml juice only');
        assert.strictEqual(result, null);
    });

    test('returns null for empty foods', () => {
        const result = addWaterFromMeal('meal-3', '');
        assert.strictEqual(result, null);
    });

    test('parses various volume formats', () => {
        assert.strictEqual(addWaterFromMeal('m1', '500ml water'), 500);
        assert.strictEqual(addWaterFromMeal('m2', '1l water'), 1000);
        assert.strictEqual(addWaterFromMeal('m3', 'water 250ml'), 250);
    });
});
