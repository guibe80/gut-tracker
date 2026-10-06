// Unit tests for ui/render.js
// Run: node --test tests/unit/render.test.js
//
// Tests the pure logic in buildTimelineEvents and entryHtml.
// Uses a VM sandbox to load dependencies (utils/datetime.js, utils/html.js,
// ui/render.js) and mocks $ for DOM queries.

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
    path.resolve(__dirname, '../../ui/render.js'),
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
    // render() needs these globals
    meals: [], glucose: [], symptoms: [], bowels: [], weights: [], mealFoods: [],
    totals: { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 },
    user: null,
    pageSize: {}, page: {},
    timelinePageSize: 10, timelinePage: 0,
    mealOptions: () => {},
    setSync: () => {},
    setMsg: () => {},
    dvRender: () => {},
    console,
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Override dvState from dayview-renderer.js
vm.runInContext(
    "dvState = { date: '2025-01-15', toggles: { food: true, glucose: true, gut: true, bowel: true, weight: true }, data: null, loading: false };",
    sandbox
);

describe('buildTimelineEvents', () => {
    const makeData = (overrides = {}) => ({
        meals: [
            { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', meal_food_id: 1 },
            { id: 2, meal_time: '2025-01-15T12:00:00.000Z', meal_type: 'lunch', meal_food_id: 2 },
        ],
        mealFoods: [
            { meal_id: 1, food_name: 'oats' },
            { meal_id: 2, food_name: 'sandwich' },
        ],
        glucose: [{ id: 1, measured_at: '2025-01-15T08:30:00.000Z', glucose_mmol_l: 5.2, timing: 'fasting' }],
        symptoms: [{ id: 1, occurred_at: '2025-01-15T10:00:00.000Z', symptom_type: 'bloating', severity: 5 }],
        bowels: [{ id: 1, occurred_at: '2025-01-15T09:00:00.000Z', bristol_type: 3 }],
        weights: [{ id: 1, measured_at: '2025-01-15T07:00:00.000Z', weight_kg: 72.5, notes: 'fasting' }],
        ...overrides,
    });

    test('includes events from all data types', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'all');
        assert.strictEqual(events.length, 6);
        const types = events.map(e => e.type);
        assert.ok(types.includes('food'));
        assert.ok(types.includes('glucose'));
        assert.ok(types.includes('gut'));
        assert.ok(types.includes('bowel'));
        assert.ok(types.includes('weight'));
    });

    test('sorts events newest-first', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'all');
        for (let i = 0; i < events.length - 1; i++) {
            assert.ok(
                new Date(events[i].t) >= new Date(events[i + 1].t),
                `Event at index ${i} (${events[i].t}) should be >= next (${events[i + 1].t})`
            );
        }
    });

    test('filters by type', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'food');
        assert.strictEqual(events.length, 2);
        assert.ok(events.every(e => e.type === 'food'));
    });

    test('filters by glucose type', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'glucose');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'glucose');
        assert.strictEqual(events[0].detail, 'fasting');
        assert.strictEqual(events[0].label, '🩸 5.2 mmol/L');
    });

    test('filters by gut type', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'gut');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'gut');
        assert.strictEqual(events[0].detail, '5/10');
        assert.strictEqual(events[0].label, '🫃 bloating');
    });

    test('filters by bowel type', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'bowel');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'bowel');
        assert.strictEqual(events[0].label, '🚽 Bristol 3');
    });

    test('filters by weight type', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'weight');
        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, 'weight');
        assert.strictEqual(events[0].label, '⚖️ 72.50 kg');
        assert.strictEqual(events[0].detail, 'fasting');
    });

    test('food events include meal food names as detail', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'food');
        const breakfast = events.find(e => e.t === '2025-01-15T08:00:00.000Z');
        assert.strictEqual(breakfast.detail, 'oats');
        const lunch = events.find(e => e.t === '2025-01-15T12:00:00.000Z');
        assert.strictEqual(lunch.detail, 'sandwich');
    });

    test('handles empty data arrays', () => {
        const empty = { meals: [], mealFoods: [], glucose: [], symptoms: [], bowels: [], weights: [] };
        const events = sandbox.buildTimelineEvents(empty, 'all');
        assert.strictEqual(events.length, 0);
    });

    test('returns all events when filter is "all"', () => {
        const events = sandbox.buildTimelineEvents(makeData(), 'all');
        const allTypes = new Set(events.map(e => e.type));
        assert.ok(allTypes.has('food'));
        assert.ok(allTypes.has('glucose'));
        assert.ok(allTypes.has('gut'));
        assert.ok(allTypes.has('bowel'));
        assert.ok(allTypes.has('weight'));
    });
});

describe('entryHtml', () => {
    test('generates HTML for a meal entry with food names', () => {
        const entry = { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: 'great' };
        const mealFoods = [{ meal_id: 1, food_name: 'oats' }];
        const html = sandbox.entryHtml('meals', entry, mealFoods);
        assert.ok(html.includes('oats'));
        assert.ok(html.includes('Edit'));
        assert.ok(html.includes('Delete'));
        assert.ok(html.includes('data-edit-table="meals"'));
        assert.ok(html.includes('data-delete-table="meals"'));
    });

    test('generates HTML for a glucose entry', () => {
        const entry = { id: 1, measured_at: '2025-01-15T08:00:00.000Z', glucose_mmol_l: 5.2, timing: 'fasting' };
        const html = sandbox.entryHtml('glucose_readings', entry, []);
        assert.ok(html.includes('5.2'));
        assert.ok(html.includes('mmol/L'));
        assert.ok(html.includes('fasting'));
        assert.ok(html.includes('data-edit-table="glucose_readings"'));
    });

    test('generates HTML for a gut symptom entry', () => {
        const entry = { id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5 };
        const html = sandbox.entryHtml('gut_symptoms', entry, []);
        assert.ok(html.includes('bloating'));
        assert.ok(html.includes('5/10'));
        assert.ok(html.includes('data-edit-table="gut_symptoms"'));
    });

    test('generates HTML for a bowel movement entry', () => {
        const entry = { id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3 };
        const html = sandbox.entryHtml('bowel_movements', entry, []);
        assert.ok(html.includes('Bristol'));
        assert.ok(html.includes('3'));
        assert.ok(html.includes('data-edit-table="bowel_movements"'));
    });

    test('generates HTML for a weight entry', () => {
        const entry = { id: 1, measured_at: '2025-01-15T08:00:00.000Z', weight_kg: 72.5, notes: 'fasting' };
        const html = sandbox.entryHtml('weight_entries', entry, []);
        assert.ok(html.includes('72.50'));
        assert.ok(html.includes('kg'));
        assert.ok(html.includes('fasting'));
        assert.ok(html.includes('data-edit-table="weight_entries"'));
    });

    test('escapes HTML in entry fields', () => {
        const entry = { id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '<script>alert(1)</script>' };
        const html = sandbox.entryHtml('meals', entry, []);
        assert.ok(html.includes('&lt;script&gt;'));
        assert.ok(!html.includes('<script>alert'));
    });

    test('returns empty string for unknown table', () => {
        const html = sandbox.entryHtml('unknown', { id: 1 }, []);
        assert.strictEqual(html, '');
    });
});
