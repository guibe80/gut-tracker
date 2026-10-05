// Unit tests for utils/validation.js
// Run: node --test tests/unit/validation.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
    path.resolve(__dirname, '../../utils/validation.js'),
    'utf8'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { supportedMealType } = sandbox;

describe('supportedMealType', () => {
    test('returns valid meal types lowercase', () => {
        assert.strictEqual(supportedMealType('Breakfast'), 'breakfast');
        assert.strictEqual(supportedMealType('LUNCH'), 'lunch');
        assert.strictEqual(supportedMealType('dinner'), 'dinner');
        assert.strictEqual(supportedMealType('Snack'), 'snack');
        assert.strictEqual(supportedMealType('drink'), 'drink');
        assert.strictEqual(supportedMealType('Other'), 'other');
    });

    test('trims whitespace', () => {
        assert.strictEqual(supportedMealType('  breakfast  '), 'breakfast');
    });

    test('returns "other" for unknown types', () => {
        assert.strictEqual(supportedMealType('brunch'), 'other');
        assert.strictEqual(supportedMealType('dessert'), 'other');
        assert.strictEqual(supportedMealType(''), 'other');
    });

    test('handles null/undefined gracefully', () => {
        assert.strictEqual(supportedMealType(null), 'other');
        assert.strictEqual(supportedMealType(undefined), 'other');
    });
});
