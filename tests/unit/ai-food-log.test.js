const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../utils/ai-food-log.js'), 'utf8'), sandbox);
const { calculateAiTotals, validateAiFoodResponse, createAiFoodSavePayload } = sandbox;

function meal(overrides = {}) {
    return { status: 'success', entry_type: 'meal', ingredients: [{ name: 'toast', quantity: 80, unit: 'g', calories_kcal: 200, carbohydrates_g: 34, protein_g: 8, fibre_g: 6, sugars_g: 4, fat_g: 3, confidence: 'medium', assumptions: [], estimation_method: 'estimate' }], totals: { calories_kcal: 200, carbohydrates_g: 34, protein_g: 8, fibre_g: 6, sugars_g: 4, fat_g: 3 }, drinks: [], diabetes_indicators: { carbohydrate_level: 'moderate', glucose_impact: 'uncertain', explanation: 'Individual responses vary.' }, needs_clarification: false, clarification_questions: [], assumptions: [], ...overrides };
}

describe('AI food-log response contract', () => {
    test('calculates food totals without counting drinks twice', () => {
        const response = meal({ drinks: [{ name: 'water', quantity: 500, unit: 'ml', is_plain_water: true, confidence: 'high', assumptions: [] }] });
        assert.deepStrictEqual({ ...calculateAiTotals(response.ingredients) }, response.totals);
        assert.strictEqual(validateAiFoodResponse(response).valid, true);
    });

    test('rejects inconsistent totals and unmeasured water', () => {
        assert.match(validateAiFoodResponse(meal({ totals: { calories_kcal: 1 } })).error, /totals/);
        const response = meal({ entry_type: 'drink', ingredients: [], totals: { calories_kcal: 0, carbohydrates_g: 0, protein_g: 0, fibre_g: 0, sugars_g: 0, fat_g: 0 }, drinks: [{ name: 'water', quantity: null, unit: null, is_plain_water: true, confidence: 'low', assumptions: [] }] });
        assert.match(validateAiFoodResponse(response).error, /water/i);
    });

    test('builds a retry-safe payload with only plain water entries', () => {
        const response = meal({ entry_type: 'mixed', drinks: [{ name: 'black tea', quantity: 300, unit: 'ml', is_plain_water: false, confidence: 'high', assumptions: [] }, { name: 'water', quantity: 250, unit: 'ml', is_plain_water: true, confidence: 'high', assumptions: [] }] });
        const payload = createAiFoodSavePayload(response, 'toast, tea and water', '2026-10-23T12:00:00Z', '00000000-0000-4000-8000-000000000001');
        assert.deepStrictEqual([...payload.p_water_amounts], [250]);
        assert.strictEqual(payload.p_ingredients.length, 1);
    });
});
