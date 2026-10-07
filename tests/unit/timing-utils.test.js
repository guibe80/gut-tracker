// Unit tests for ui/timing-utils.js
// Run: node --test tests/unit/timing-utils.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load timing-utils.js in a vm sandbox (same pattern as datetime.test.js).
// Note: const/let declarations on the top level are NOT exposed as
// sandbox properties, so we only destructure function declarations.
const code = fs.readFileSync(
    path.resolve(__dirname, '../../ui/timing-utils.js'),
    'utf8'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const {
    getTimingOffset,
    getPreferredTiming,
    setPreferredTiming,
    clearMealTiming,
    calculateTime,
    splitDateTime,
    applyMealTiming
} = sandbox;

/* ------------------------------------------------------------------ */

describe('getTimingOffset', () => {
    test('returns positive offset for post-meal timings', () => {
        assert.strictEqual(getTimingOffset('30_min_after'), 30);
        assert.strictEqual(getTimingOffset('1_hour_after'), 60);
        assert.strictEqual(getTimingOffset('2_hours_after'), 120);
        assert.strictEqual(getTimingOffset('3_hours_after'), 180);
    });

    test('returns negative offset for before_meal', () => {
        assert.strictEqual(getTimingOffset('before_meal'), -30);
    });

    test('returns null for non-meal timings', () => {
        assert.strictEqual(getTimingOffset('fasting'), null);
        assert.strictEqual(getTimingOffset('random'), null);
        assert.strictEqual(getTimingOffset('bedtime'), null);
        assert.strictEqual(getTimingOffset('other'), null);
    });

    test('returns null for unknown timing', () => {
        assert.strictEqual(getTimingOffset('unknown'), null);
    });
});

describe('calculateTime', () => {
    const mealTime = '2025-06-15T12:30:00.000Z'; // UTC 12:30

    test('adds 30 min for 30_min_after', () => {
        const result = calculateTime(mealTime, '30_min_after');
        assert.ok(result);
        assert.strictEqual(result.getUTCMinutes(), 0);  // 13:00 UTC
        assert.strictEqual(result.getUTCHours(), 13);
    });

    test('adds 60 min for 1_hour_after', () => {
        const result = calculateTime(mealTime, '1_hour_after');
        assert.ok(result);
        assert.strictEqual(result.getUTCHours(), 13);  // 13:30 UTC
        assert.strictEqual(result.getUTCMinutes(), 30);
    });

    test('adds 120 min for 2_hours_after', () => {
        const result = calculateTime(mealTime, '2_hours_after');
        assert.ok(result);
        assert.strictEqual(result.getUTCHours(), 14);  // 14:30 UTC
        assert.strictEqual(result.getUTCMinutes(), 30);
    });

    test('adds 180 min for 3_hours_after', () => {
        const result = calculateTime(mealTime, '3_hours_after');
        assert.ok(result);
        assert.strictEqual(result.getUTCHours(), 15);  // 15:30 UTC
        assert.strictEqual(result.getUTCMinutes(), 30);
    });

    test('subtracts 30 min for before_meal', () => {
        const result = calculateTime(mealTime, 'before_meal');
        assert.ok(result);
        assert.strictEqual(result.getUTCHours(), 12);  // 12:00 UTC
        assert.strictEqual(result.getUTCMinutes(), 0);
    });

    test('returns null for non-meal timing', () => {
        assert.strictEqual(calculateTime(mealTime, 'fasting'), null);
        assert.strictEqual(calculateTime(mealTime, 'random'), null);
        assert.strictEqual(calculateTime(mealTime, 'bedtime'), null);
        assert.strictEqual(calculateTime(mealTime, 'other'), null);
    });

    test('returns null for invalid meal time', () => {
        assert.strictEqual(calculateTime('not-a-date', '1_hour_after'), null);
    });

    test('returns null for null/empty meal time', () => {
        assert.strictEqual(calculateTime(null, '1_hour_after'), null);
        assert.strictEqual(calculateTime('', '1_hour_after'), null);
        assert.strictEqual(calculateTime(undefined, '1_hour_after'), null);
    });
});

describe('splitDateTime', () => {
    test('returns date and time strings from ISO string', () => {
        const result = splitDateTime('2025-06-15T14:30:00.000Z');
        assert.ok(result.date.match(/^\d{4}-\d{2}-\d{2}$/));
        assert.ok(result.time.match(/^\d{2}:\d{2}$/));
    });

    test('returns date and time from Date object', () => {
        const d = new Date(2025, 5, 15, 14, 30); // Jun 15, 2025, 14:30 local
        const result = splitDateTime(d);
        assert.strictEqual(result.date, '2025-06-15');
        assert.strictEqual(result.time, '14:30');
    });
});

describe('getPreferredTiming', () => {
    test('returns default (1_hour_after) when no override stored', () => {
        assert.strictEqual(getPreferredTiming('meal-never-touched'), '1_hour_after');
    });

    test('returns stored override when present', () => {
        setPreferredTiming('meal-override', '2_hours_after');
        assert.strictEqual(getPreferredTiming('meal-override'), '2_hours_after');
        clearMealTiming('meal-override');
    });

    test('returns default after override is cleared', () => {
        setPreferredTiming('meal-clear', '30_min_after');
        clearMealTiming('meal-clear');
        assert.strictEqual(getPreferredTiming('meal-clear'), '1_hour_after');
    });
});

describe('applyMealTiming', () => {
    const meal = {
        id: 'meal-1',
        meal_time: '2025-06-15T12:30:00.000Z',
        estimated_carbohydrate_g: 45
    };

    test('returns derived fields for a valid meal and timing', () => {
        const result = applyMealTiming(meal, '1_hour_after');
        assert.ok(result);
        assert.ok(result.date.match(/^\d{4}-\d{2}-\d{2}$/));
        assert.ok(result.time.match(/^\d{2}:\d{2}$/));
        assert.strictEqual(result.timing, '1_hour_after');
        assert.strictEqual(result.carbs, 45);
        assert.strictEqual(result.minutesFromMeal, 60);
    });

    test('returns null when timing has no meal offset', () => {
        assert.strictEqual(applyMealTiming(meal, 'random'), null);
        assert.strictEqual(applyMealTiming(meal, 'fasting'), null);
    });

    test('returns null when meal is null', () => {
        assert.strictEqual(applyMealTiming(null, '1_hour_after'), null);
    });

    test('returns null when meal has no meal_time', () => {
        const mealNoTime = { id: 'm', estimated_carbohydrate_g: 10 };
        assert.strictEqual(applyMealTiming(mealNoTime, '1_hour_after'), null);
    });

    test('uses empty carbs when meal has none', () => {
        const mealNoCarbs = {
            id: 'm',
            meal_time: '2025-06-15T12:30:00.000Z',
            estimated_carbohydrate_g: null
        };
        const result = applyMealTiming(mealNoCarbs, '30_min_after');
        assert.ok(result);
        assert.strictEqual(result.carbs, '');
    });
});
