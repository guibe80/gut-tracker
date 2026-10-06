// Unit tests for utils/html.js
// Run: node --test tests/unit/html.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
    path.resolve(__dirname, '../../utils/html.js'),
    'utf8'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { esc } = sandbox;

describe('esc', () => {
    test('escapes & to &amp;', () => {
        assert.strictEqual(esc('&'), '&amp;');
    });

    test('escapes < to &lt;', () => {
        assert.strictEqual(esc('<'), '&lt;');
    });

    test('escapes > to &gt;', () => {
        assert.strictEqual(esc('>'), '&gt;');
    });

    test('escapes single quote to &#39;', () => {
        assert.strictEqual(esc("'"), '&#39;');
    });

    test('escapes double quote to &quot;', () => {
        assert.strictEqual(esc('"'), '&quot;');
    });

    test('escapes a full HTML string', () => {
        assert.strictEqual(esc('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('returns empty string for null/undefined', () => {
        assert.strictEqual(esc(null), '');
        assert.strictEqual(esc(undefined), '');
    });

    test('converts numbers to strings and escapes', () => {
        assert.strictEqual(esc(42), '42');
    });

    test('leaves safe text unchanged', () => {
        assert.strictEqual(esc('Hello World'), 'Hello World');
    });
});
