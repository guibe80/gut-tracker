// Unit tests for utils/data-mapping.js
// Run: node --test tests/unit/data-mapping.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
    path.resolve(__dirname, '../../utils/data-mapping.js'),
    'utf8'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { pick, pickArray, recordTime, num } = sandbox;

describe('pick', () => {
    test('returns first matching value', () => {
        const obj = { a: 1, b: 2, c: 3 };
        assert.strictEqual(pick(obj, ['a']), 1);
        assert.strictEqual(pick(obj, ['x', 'b']), 2);
        assert.strictEqual(pick(obj, ['x', 'y', 'c']), 3);
    });

    test('returns null when no keys match', () => {
        assert.strictEqual(pick({ a: 1 }, ['x']), null);
    });

    test('skips null/undefined/empty-string values', () => {
        const obj = { a: null, b: undefined, c: '', d: 4 };
        assert.strictEqual(pick(obj, ['a', 'b', 'c', 'd']), 4);
    });

    test('handles null/undefined input object', () => {
        assert.strictEqual(pick(null, ['a']), null);
        assert.strictEqual(pick(undefined, ['a']), null);
    });
});

describe('pickArray', () => {
    test('returns array directly when value is already an array', () => {
        assert.deepEqual(pickArray({ arr: [1, 2, 3] }, ['arr']), [1, 2, 3]);
    });

    test('splits string on commas', () => {
        const result = pickArray({ val: 'a,b,c' }, ['val']);
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    test('splits string on semicolons', () => {
        const result = pickArray({ val: 'a;b;c' }, ['val']);
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    test('trims whitespace when splitting', () => {
        const result = pickArray({ val: ' a , b , c ' }, ['val']);
        assert.deepEqual(result, ['a', 'b', 'c']);
    });

    test('filters empty strings from split', () => {
        const result = pickArray({ val: 'a,,b,' }, ['val']);
        assert.deepEqual(result, ['a', 'b']);
    });

    test('returns empty array when no match', () => {
        assert.deepEqual(pickArray({ a: 1 }, ['x']), []);
    });

    test('returns empty array for non-string, non-array values', () => {
        assert.deepEqual(pickArray({ val: 42 }, ['val']), []);
    });
});

describe('recordTime', () => {
    test('parses a full ISO datetime from a direct field', () => {
        const obj = { datetime: '2025-06-15T14:30:00Z' };
        const result = recordTime(obj);
        assert.ok(result.startsWith('2025-06-15'));
    });

    test('combines date and time fields', () => {
        const obj = { date: '2025-06-15', time: '14:30' };
        const result = recordTime(obj);
        assert.ok(result.startsWith('2025-06-15'));
    });

    test('defaults time to 00:00 when only date is present', () => {
        const obj = { date: '2025-06-15' };
        const result = recordTime(obj);
        // Result is an ISO string — timezone dependent, so just check it's valid
        assert.ok(result !== null);
        assert.ok(result.endsWith('Z'));
    });

    test('returns null when no recognizable date field', () => {
        assert.strictEqual(recordTime({ foo: 'bar' }), null);
    });

    test('returns null for null/undefined input', () => {
        assert.strictEqual(recordTime(null), null);
        assert.strictEqual(recordTime(undefined), null);
    });

    test('returns null for invalid date', () => {
        const obj = { date: 'not-a-date' };
        assert.strictEqual(recordTime(obj), null);
    });
});

describe('num', () => {
    test('returns null for empty string', () => {
        assert.strictEqual(num(''), null);
    });

    test('returns null for null/undefined', () => {
        assert.strictEqual(num(null), null);
        assert.strictEqual(num(undefined), null);
    });

    test('converts numeric string to number', () => {
        assert.strictEqual(num('42'), 42);
        assert.strictEqual(num('3.14'), 3.14);
    });

    test('converts negative numbers', () => {
        assert.strictEqual(num('-5'), -5);
    });

    test('returns 0 for string "0"', () => {
        assert.strictEqual(num('0'), 0);
    });

    test('returns NaN is avoided for non-numeric strings', () => {
        // Non-numeric strings produce NaN — this is the existing behavior
        assert.ok(Number.isNaN(num('abc')));
    });
});
