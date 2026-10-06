// Unit tests for ui/dayview-renderer.js
// Run: node --test tests/unit/dayview-renderer.test.js
//
// Tests the pure data transformation logic in dvGetEvents.
// Uses a VM sandbox to load dependencies (utils/datetime.js, utils/html.js,
// utils/data-mapping.js, services/data-service.js, ui/dayview-renderer.js)
// and mocks $ for DOM queries.

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToLoad = [
    path.resolve(__dirname, '../../utils/datetime.js'),
    path.resolve(__dirname, '../../utils/supabase-helpers.js'),
    path.resolve(__dirname, '../../utils/validation.js'),
    path.resolve(__dirname, '../../utils/html.js'),
    path.resolve(__dirname, '../../utils/data-mapping.js'),
    path.resolve(__dirname, '../../services/data-service.js'),
    path.resolve(__dirname, '../../ui/dayview-renderer.js'),
];

const code = filesToLoad.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const sandbox = {
    confirm: () => true,
    $: (id) => ({ value: '', innerHTML: '', textContent: '', classList: { add: () => {}, remove: () => {} } }),
    document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
    },
    window: {},
    console,
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Set dvState from within the VM context (let bindings can't be overridden
// from the host side — must use runInContext to reassign)
vm.runInContext(
    "dvState = { date: '2025-01-15', toggles: { food: true, glucose: true, gut: true, bowel: true, weight: true }, data: null, loading: false };",
    sandbox
);

describe('dvGetEvents', () => {
    test('returns empty array for null data', () => {
        assert.deepEqual(sandbox.dvGetEvents(null, 'food'), []);
        assert.deepEqual(sandbox.dvGetEvents(null, 'glucose'), []);
    });

    test('returns empty array for unknown type', () => {
        const data = { meals: [], glucose: [], symptoms: [], bowels: [], weights: [], mealFoods: [] };
        assert.deepEqual(sandbox.dvGetEvents(data, 'unknown'), []);
    });

    test('transforms food records into events', () => {
        const data = {
            meals: [
                { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', estimated_carbohydrate_g: 50, notes: 'notes [tz:+00:00]' },
                { id: 2, meal_time: '2025-01-15T12:30:00.000Z', meal_type: 'lunch', estimated_carbohydrate_g: 30, notes: 'no tz' },
            ],
            mealFoods: [
                { meal_id: 1, food_name: 'oats' },
                { meal_id: 1, food_name: 'banana' },
            ],
            glucose: [], symptoms: [], bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'food');
        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].type, 'food');
        assert.strictEqual(events[0].detail, 'oats, banana');
        assert.strictEqual(events[0].value, 50);
        assert.strictEqual(events[0].t, '2025-01-15T08:00:00.000Z');
        assert.strictEqual(events[0].tz, 0); // '+00:00' parsed by parseTzNotes
        assert.strictEqual(events[1].detail, '');
        assert.strictEqual(events[1].value, 30);
        // Should be sorted by time
        assert.ok(events[0].t < events[1].t || events[0].t.localeCompare(events[1].t) <= 0);
    });

    test('transforms glucose records into events', () => {
        const data = {
            meals: [], mealFoods: [],
            glucose: [
                { id: 1, measured_at: '2025-01-15T08:00:00.000Z', glucose_mmol_l: 5.2, timing: 'fasting', notes: '' },
                { id: 2, measured_at: '2025-01-15T14:00:00.000Z', glucose_mmol_l: 6.8, timing: 'post-meal', notes: '' },
            ],
            symptoms: [], bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'glucose');
        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].type, 'glucose');
        assert.strictEqual(events[0].detail, '5.2 mmol/L');
        assert.strictEqual(events[0].value, 5.2);
        assert.strictEqual(events[0].t, '2025-01-15T08:00:00.000Z');
        assert.strictEqual(events[1].detail, '6.8 mmol/L');
        assert.strictEqual(events[1].value, 6.8);
    });

    test('transforms gut symptom records into events', () => {
        const data = {
            meals: [], mealFoods: [],
            glucose: [],
            symptoms: [
                { id: 1, occurred_at: '2025-01-15T10:00:00.000Z', symptom_type: 'bloating', severity: 7, notes: '' },
            ],
            bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'gut');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'gut');
        assert.strictEqual(events[0].detail, 'bloating · 7/10');
        assert.strictEqual(events[0].t, '2025-01-15T10:00:00.000Z');
    });

    test('transforms bowel records into events', () => {
        const data = {
            meals: [], mealFoods: [],
            glucose: [], symptoms: [],
            bowels: [
                { id: 1, occurred_at: '2025-01-15T09:00:00.000Z', bristol_type: 3, notes: '' },
            ],
            weights: []
        };
        const events = sandbox.dvGetEvents(data, 'bowel');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'bowel');
        assert.strictEqual(events[0].detail, 'Bristol 3');
        assert.strictEqual(events[0].t, '2025-01-15T09:00:00.000Z');
    });

    test('transforms weight records into events', () => {
        const data = {
            meals: [], mealFoods: [],
            glucose: [], symptoms: [], bowels: [],
            weights: [
                { id: 1, measured_at: '2025-01-15T08:00:00.000Z', weight_kg: 72.5, notes: '' },
            ],
        };
        const events = sandbox.dvGetEvents(data, 'weight');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'weight');
        assert.strictEqual(events[0].detail, '72.50 kg');
        assert.strictEqual(events[0].value, 72.5);
        assert.strictEqual(events[0].t, '2025-01-15T08:00:00.000Z');
    });

    test('filters events outside the day boundary', () => {
        const data = {
            meals: [
                { id: 1, meal_time: '2025-01-15T12:00:00.000Z', meal_type: 'lunch', estimated_carbohydrate_g: 0, notes: '' },
                // This one is on the next day — should be filtered out
                { id: 2, meal_time: '2025-01-16T12:00:00.000Z', meal_type: 'lunch', estimated_carbohydrate_g: 0, notes: '' },
                // This one is on the previous day — should be filtered out
                { id: 3, meal_time: '2025-01-14T12:00:00.000Z', meal_type: 'lunch', estimated_carbohydrate_g: 0, notes: '' },
            ],
            mealFoods: [], glucose: [], symptoms: [], bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'food');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].t, '2025-01-15T12:00:00.000Z');
    });

    test('sorts events by time', () => {
        const data = {
            meals: [
                { id: 3, meal_time: '2025-01-15T18:00:00.000Z', meal_type: 'dinner', estimated_carbohydrate_g: 0, notes: '' },
                { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', estimated_carbohydrate_g: 0, notes: '' },
                { id: 2, meal_time: '2025-01-15T12:00:00.000Z', meal_type: 'lunch', estimated_carbohydrate_g: 0, notes: '' },
            ],
            mealFoods: [], glucose: [], symptoms: [], bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'food');
        assert.strictEqual(events.length, 3);
        assert.strictEqual(events[0].t, '2025-01-15T08:00:00.000Z');
        assert.strictEqual(events[1].t, '2025-01-15T12:00:00.000Z');
        assert.strictEqual(events[2].t, '2025-01-15T18:00:00.000Z');
    });

    test('defaults meal food value to 0 when not set', () => {
        const data = {
            meals: [
                { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '' },
            ],
            mealFoods: [], glucose: [], symptoms: [], bowels: [], weights: []
        };
        const events = sandbox.dvGetEvents(data, 'food');
        assert.strictEqual(events[0].value, 0);
    });

    test('handles empty arrays gracefully', () => {
        const data = { meals: [], glucose: [], symptoms: [], bowels: [], weights: [], mealFoods: [] };
        assert.deepEqual(sandbox.dvGetEvents(data, 'food'), []);
        assert.deepEqual(sandbox.dvGetEvents(data, 'glucose'), []);
        assert.deepEqual(sandbox.dvGetEvents(data, 'gut'), []);
        assert.deepEqual(sandbox.dvGetEvents(data, 'bowel'), []);
        assert.deepEqual(sandbox.dvGetEvents(data, 'weight'), []);
    });
});
