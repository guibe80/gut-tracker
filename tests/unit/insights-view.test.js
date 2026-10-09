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
    test('aggregates a monthly view by local date buckets', () => {
        vm.runInContext("insightsState.mode = 'month'; insightsState.monthOffset = 0;", sandbox);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day1 = new Date(year, month, 1, 8, 0, 0);
        const day15 = new Date(year, month, 15, 18, 0, 0);
        const day20 = new Date(year, month, 20, 8, 0, 0);
        const day7 = new Date(year, month, 7, 8, 0, 0);
        const day11 = new Date(year, month, 11, 8, 0, 0);

        sandbox.data = {
            meals: [
                { meal_time: day1.toISOString(), estimated_carbohydrate_g: 20 },
                { meal_time: day15.toISOString(), estimated_carbohydrate_g: 30 },
            ],
            glucose: [
                { measured_at: day1.toISOString(), glucose_mmol_l: 5.5 },
                { measured_at: day20.toISOString(), glucose_mmol_l: 6.2 },
            ],
            weights: [
                { measured_at: day7.toISOString(), weight_kg: 70.5 },
            ],
            water: [
                { consumed_at: day11.toISOString(), amount_ml: 500 },
            ],
        };

        const result = vm.runInContext('aggregateByMonth(data)', sandbox);
        assert.ok(Array.isArray(result));
        assert.ok(result.length >= 1);
        assert.ok(result.some(day => day.carbs === 20 || day.carbs === 30));
        assert.ok(result.some(day => day.glucoseCount === 1 && day.glucoseSum >= 5.5));
    });
});

describe('insights chart rendering', () => {
    test('uses dotted connecting lines and day-view aligned y-axis label positioning', () => {
        const html = vm.runInContext("buildTrendChart([5, 6, 7], ['01', '02', '03'], 'glucose', 'mmol/L')", sandbox);
        assert.match(html, /stroke-dasharray="4 2"/);
        assert.match(html, /right:\s*1px/);
        assert.match(html, /chart-yaxis-label/);
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
