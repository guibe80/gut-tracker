// Unit tests for services/v2-import.js
// Run: node --test tests/unit/v2-import.test.js
//
// Tests the dedup helper functions (hasImportedFood, hasImportedSymptom,
// hasImportedBowel) and the exportV3Backup function.
// These are loaded from services/data-service.js (dedup functions) and
// services/v2-import.js (export function).

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToLoad = [
    path.resolve(__dirname, '../../utils/supabase-helpers.js'),
    path.resolve(__dirname, '../../utils/validation.js'),
    path.resolve(__dirname, '../../utils/html.js'),
    path.resolve(__dirname, '../../utils/data-mapping.js'),
    path.resolve(__dirname, '../../services/data-service.js'),
    path.resolve(__dirname, '../../ui/dayview-renderer.js'),
    path.resolve(__dirname, '../../ui/render.js'),
    path.resolve(__dirname, '../../services/v2-import.js'),
];

const code = filesToLoad.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const sandbox = {
    confirm: () => true,
    $: (id) => ({ value: '', innerHTML: '', textContent: '', classList: { add: () => {}, remove: () => {} } }),
    document: {
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({ href: '', download: '', click: () => {}, style: {} }),
    },
    window: {},
    URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
    Blob: class { constructor(parts) { this.parts = parts; } },
    // Data arrays needed by exportV3Backup
    meals: [], glucose: [], symptoms: [], bowels: [], weights: [], mealFoods: [],
    supabaseClient: null,
    user: null,
    setSync: () => {},
    setMsg: () => {},
    render: () => {},
    editState: null,
    setFormMode: () => {},
    console,
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// Override dvState from dayview-renderer.js
vm.runInContext(
    "dvState = { date: '2025-01-15', toggles: { food: true, glucose: true, gut: true, bowel: true, weight: true }, data: null, loading: false };",
    sandbox
);

describe('hasImportedFood', () => {
    test('returns true when source marker is in any meal notes', () => {
        const state = {
            meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '[V2 migration:food:src-1] original' }],
            foods: [{ meal_id: 1, food_name: 'oats', notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedFood(state, source, '2025-01-15T08:00:00.000Z', 'breakfast', 'oats'), true);
    });

    test('returns true when meal+food match with V2 migration marker', () => {
        const state = {
            meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '[V2 migration]' }],
            foods: [{ meal_id: 1, food_name: 'oats', notes: '[V2 migration]' }],
        };
        const source = { id: 'src-99' };
        assert.strictEqual(sandbox.hasImportedFood(state, source, '2025-01-15T08:00:00.000Z', 'breakfast', 'oats'), true);
    });

    test('returns false when no matching meal exists', () => {
        const state = {
            meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: 'regular notes' }],
            foods: [{ meal_id: 1, food_name: 'oats', notes: 'regular' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedFood(state, source, '2025-01-15T08:00:00.000Z', 'breakfast', 'oats'), false);
    });

    test('returns false when food name does not match', () => {
        const state = {
            meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '[V2 migration]' }],
            foods: [{ meal_id: 1, food_name: 'oats', notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedFood(state, source, '2025-01-15T08:00:00.000Z', 'breakfast', 'different food'), false);
    });

    test('returns false when meal type does not match', () => {
        const state = {
            meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', notes: '[V2 migration]' }],
            foods: [{ meal_id: 1, food_name: 'oats', notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedFood(state, source, '2025-01-15T08:00:00.000Z', 'lunch', 'oats'), false);
    });
});

describe('hasImportedSymptom', () => {
    test('returns true when source marker is in any symptom notes', () => {
        const state = {
            symptoms: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5, notes: '[V2 migration:symptom:src-1:bloating] original' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedSymptom(state, source, 'bloating', '2025-01-15T08:00:00.000Z', 'bloating', 5), true);
    });

    test('returns true when symptom matches with V2 migration marker', () => {
        const state = {
            symptoms: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5, notes: '[V2 migration]' }],
        };
        const source = { id: 'src-99' };
        assert.strictEqual(sandbox.hasImportedSymptom(state, source, 'bloating', '2025-01-15T08:00:00.000Z', 'bloating', 5), true);
    });

    test('returns false when symptom_type does not match', () => {
        const state = {
            symptoms: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5, notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedSymptom(state, source, 'bloating', '2025-01-15T08:00:00.000Z', 'abdominal_pain', 5), false);
    });

    test('returns false when severity does not match', () => {
        const state = {
            symptoms: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5, notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedSymptom(state, source, 'bloating', '2025-01-15T08:00:00.000Z', 'bloating', 3), false);
    });

    test('returns false when no matching symptom exists', () => {
        const state = {
            symptoms: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating', severity: 5, notes: 'regular' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedSymptom(state, source, 'bloating', '2025-01-15T08:00:00.000Z', 'bloating', 5), false);
    });
});

describe('hasImportedBowel', () => {
    test('returns true when source marker is in any bowel notes', () => {
        const state = {
            bowels: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3, notes: '[V2 migration:bowel:src-1] original' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedBowel(state, source, '2025-01-15T08:00:00.000Z', 3), true);
    });

    test('returns true when bowel matches with V2 migration marker', () => {
        const state = {
            bowels: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3, notes: '[V2 migration]' }],
        };
        const source = { id: 'src-99' };
        assert.strictEqual(sandbox.hasImportedBowel(state, source, '2025-01-15T08:00:00.000Z', 3), true);
    });

    test('returns false when bristol_type does not match', () => {
        const state = {
            bowels: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3, notes: '[V2 migration]' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedBowel(state, source, '2025-01-15T08:00:00.000Z', 4), false);
    });

    test('returns false when no matching bowel exists', () => {
        const state = {
            bowels: [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3, notes: 'regular' }],
        };
        const source = { id: 'src-1' };
        assert.strictEqual(sandbox.hasImportedBowel(state, source, '2025-01-15T08:00:00.000Z', 3), false);
    });
});

describe('exportV3Backup', () => {
    test('creates a blob with version 3 and all data arrays', () => {
        let capturedBlob = null;
        sandbox.meals = [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast' }];
        sandbox.glucose = [{ id: 1, measured_at: '2025-01-15T08:00:00.000Z', glucose_mmol_l: 5.2 }];
        sandbox.symptoms = [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', symptom_type: 'bloating' }];
        sandbox.bowels = [{ id: 1, occurred_at: '2025-01-15T08:00:00.000Z', bristol_type: 3 }];
        sandbox.weights = [{ id: 1, measured_at: '2025-01-15T08:00:00.000Z', weight_kg: 72.5 }];
        sandbox.mealFoods = [{ meal_id: 1, food_name: 'oats' }];

        const originalBlob = sandbox.Blob;
        sandbox.Blob = class {
            constructor(parts) {
                this.parts = parts;
                capturedBlob = this;
            }
        };

        try {
            sandbox.exportV3Backup();
            const json = JSON.parse(capturedBlob.parts[0]);
            assert.strictEqual(json.version, 3);
            assert.ok(json.exportedAt);
            assert.deepEqual(json.meals, sandbox.meals);
            assert.deepEqual(json.glucose_readings, sandbox.glucose);
            assert.deepEqual(json.gut_symptoms, sandbox.symptoms);
            assert.deepEqual(json.bowel_movements, sandbox.bowels);
            assert.deepEqual(json.weight_entries, sandbox.weights);
            assert.deepEqual(json.meal_foods, sandbox.mealFoods);
        } finally {
            sandbox.Blob = originalBlob;
        }
    });

    test('creates an anchor element for download', () => {
        let anchorCreated = false;
        let originalCreateElement = sandbox.document.createElement;
        sandbox.document.createElement = (tag) => {
            if (tag === 'a') {
                anchorCreated = true;
                return {
                    href: '',
                    download: '',
                    click: () => {},
                    style: {},
                };
            }
            return originalCreateElement(tag);
        };

        try {
            sandbox.exportV3Backup();
            assert.strictEqual(anchorCreated, true);
        } finally {
            sandbox.document.createElement = originalCreateElement;
        }
    });
});
