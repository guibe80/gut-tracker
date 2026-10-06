// Unit tests for utils/supabase-helpers.js
// Run: node --test tests/unit/supabase-helpers.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
    path.resolve(__dirname, '../../utils/supabase-helpers.js'),
    'utf8'
);

// Provide Node.js globals in the VM context so instanceof checks and
// setTimeout work correctly when the functions are loaded outside a browser.
const sandbox = { TypeError, setTimeout, Promise, parseInt, String };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { missingColumn, isNetworkError, wait } = sandbox;

describe('missingColumn', () => {
    test('extracts column name from Supabase schema error', () => {
        const error = new Error("Could not find the 'fibre_estimate_g' column of 'meals' in the schema cache");
        assert.strictEqual(missingColumn(error), 'fibre_estimate_g');
    });

    test('returns null for non-schema errors', () => {
        assert.strictEqual(missingColumn(new Error('Some other error')), null);
    });

    test('returns null for null/undefined input', () => {
        assert.strictEqual(missingColumn(null), null);
        assert.strictEqual(missingColumn(undefined), null);
    });

    test('returns null when error has no message', () => {
        assert.strictEqual(missingColumn({}), null);
    });

    test('matches case-insensitively', () => {
        const error = new Error("could not find the 'protein_estimate_g' column of 'meals' in the SCHEMA CACHE");
        assert.strictEqual(missingColumn(error), 'protein_estimate_g');
    });
});

describe('isNetworkError', () => {
    test('identifies TypeError as network error', () => {
        assert.strictEqual(isNetworkError(new TypeError('Failed to execute')), true);
    });

    test('identifies "failed to fetch" as network error', () => {
        assert.strictEqual(isNetworkError(new Error('Failed to fetch')), true);
    });

    test('identifies "network request failed" as network error', () => {
        assert.strictEqual(isNetworkError(new Error('Network request failed')), true);
    });

    test('identifies generic Error as non-network', () => {
        assert.strictEqual(isNetworkError(new Error('Some API error')), false);
    });

    test('handles non-Error values gracefully', () => {
        assert.strictEqual(isNetworkError('string error'), false);
        assert.strictEqual(isNetworkError(null), false);
    });
});

describe('wait', () => {
    test('resolves after the specified delay', async () => {
        const start = Date.now();
        await wait(50);
        const elapsed = Date.now() - start;
        assert.ok(elapsed >= 40, `Expected >= 40ms, got ${elapsed}ms`);
        assert.ok(elapsed < 200, `Expected < 200ms, got ${elapsed}ms`);
    });

    test('resolves immediately for 0ms', async () => {
        const start = Date.now();
        await wait(0);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 50, `Expected < 50ms, got ${elapsed}ms`);
    });
});
