// Unit tests for ui/insights-view.js
// Run: node --test tests/unit/insights-view.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const datetimeCode = fs.readFileSync(path.resolve(__dirname, '../../utils/datetime.js'), 'utf8');
const insightsCode = fs.readFileSync(path.resolve(__dirname, '../../ui/insights-view.js'), 'utf8');

const sandbox = {
    console,
    supabaseClient: null,
    user: null,
    esc: (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    $: () => ({ innerHTML: '', value: '', textContent: '', style: {} }),
    document: { getElementById: () => null },
};

vm.createContext(sandbox);
vm.runInContext(datetimeCode, sandbox);
vm.runInContext(insightsCode, sandbox);

describe('insights month aggregation', () => {
    test('groups monthly data into weekly averages instead of daily buckets', () => {
        vm.runInContext("insightsState.mode = 'month'; insightsState.monthOffset = 0;", sandbox);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day1 = new Date(year, month, 1, 8, 0, 0);
        const day5 = new Date(year, month, 5, 12, 0, 0);
        const day12 = new Date(year, month, 12, 8, 0, 0);
        const day16 = new Date(year, month, 16, 18, 0, 0);
        const day20 = new Date(year, month, 20, 8, 0, 0);
        const day25 = new Date(year, month, 25, 8, 0, 0);

        sandbox.data = {
            meals: [
                { meal_time: day1.toISOString(), estimated_carbohydrate_g: 20 },
                { meal_time: day5.toISOString(), estimated_carbohydrate_g: 40 },
                { meal_time: day12.toISOString(), estimated_carbohydrate_g: 50 },
                { meal_time: day16.toISOString(), estimated_carbohydrate_g: 30 },
            ],
            glucose: [
                { measured_at: day1.toISOString(), glucose_mmol_l: 5.5 },
                { measured_at: day20.toISOString(), glucose_mmol_l: 6.2 },
                { measured_at: day25.toISOString(), glucose_mmol_l: 5.8 },
            ],
            weights: [
                { measured_at: day12.toISOString(), weight_kg: 70.5 },
            ],
            water: [
                { consumed_at: day16.toISOString(), amount_ml: 500 },
            ],
        };

        const result = vm.runInContext('aggregateByMonth(data)', sandbox);
        assert.ok(Array.isArray(result));
        assert.ok(result.length > 0 && result.length <= 5, `Expected 1-5 weekly buckets, got ${result.length}`);
        assert.ok(result.every(bucket => bucket.carbs >= 0));
        assert.ok(result.some(bucket => bucket.label && bucket.label.startsWith('W')));
        assert.ok(result.some(bucket => bucket.carbs > 0 && bucket.carbs < 50));
    });
});

describe('insights chart rendering', () => {
    test('uses dotted connecting lines and day-view aligned y-axis label positioning', () => {
        const html = vm.runInContext("buildTrendChart([5, 6, 7], ['04-Oct', '05-Oct', '06-Oct'], 'glucose', 'mmol/L')", sandbox);
        assert.match(html, /stroke-dasharray="4 2"/);
        assert.match(html, /right:\s*1px/);
        assert.match(html, /chart-yaxis-label/);
        assert.match(html, /04-Oct/);
    });

    test('formats daily x-axis labels as DD-MMM', () => {
        assert.equal(vm.runInContext("formatInsightAxisLabel('2024-10-04')", sandbox), '04-Oct');
        assert.equal(vm.runInContext("formatInsightAxisLabel('2024-12-31')", sandbox), '31-Dec');
    });

    test('toggles the mode when the actual insights mode button is clicked', () => {
        vm.runInContext("insightsState.mode = 'week'; insightsState.weekOffset = 0; insightsState.monthOffset = 0;", sandbox);
        sandbox.supabaseClient = { from: () => ({ select: () => ({ gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }) };
        sandbox.user = { id: 'u1' };
        const toggle = { textContent: '📅 Monthly', listeners: {}, addEventListener(type, cb) { this.listeners[type] = cb; } };
        toggle.click = () => toggle.listeners.click();
        const container = { listeners: {}, addEventListener(type, cb) { this.listeners[type] = cb; } };
        const mockDom = { insightsModeToggle: toggle, insightsView: container };
        sandbox.$ = (id) => mockDom[id] || null;
        vm.runInContext("installInsightsView()", sandbox);
        toggle.click();
        assert.equal(vm.runInContext('insightsState.mode', sandbox), 'month');
        assert.match(toggle.textContent, /Weekly/);
    });
});
