// Unit tests for ui/hba1c-trend.js
// Run: node --test tests/unit/hba1c-trend.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
    path.resolve(__dirname, '../../ui/hba1c-trend.js'),
    'utf8'
);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { toMmolMol, fmtEstimate, calculate, renderHbA1c, installHbA1cTrend } = sandbox;

describe('toMmolMol', () => {
    test('converts known glucose value to HbA1c mmol/mol', () => {
        const result = toMmolMol(8.0);
        const pct = (28.7 * 8.0 + 46.7) / 25.7;
        const expected = (pct - 2.15) * 10.929;
        assert.strictEqual(result, expected);
    });

    test('returns a finite number for valid input', () => {
        assert.ok(Number.isFinite(toMmolMol(6.0)));
        assert.ok(Number.isFinite(toMmolMol(10.0)));
    });

    test('returns NaN for NaN input', () => {
        assert.ok(Number.isNaN(toMmolMol(NaN)));
    });
});

describe('fmtEstimate', () => {
    test('formats finite number with mmol/mol suffix', () => {
        assert.strictEqual(fmtEstimate(52.3), '52 mmol/mol');
    });

    test('formats non-finite values as em-dash', () => {
        assert.strictEqual(fmtEstimate(NaN), '—');
        assert.strictEqual(fmtEstimate(Infinity), '—');
    });
});

describe('calculate', () => {
    test('returns null for empty array', () => {
        assert.strictEqual(calculate([]), null);
    });

    test('returns null when all values are invalid strings/undefined', () => {
        assert.strictEqual(calculate([{ glucose_mmol_l: undefined }, { glucose_mmol_l: 'abc' }]), null);
    });

    test('calculates from single valid value', () => {
        const result = calculate([{ glucose_mmol_l: 6.0 }]);
        assert.ok(result);
        assert.strictEqual(result.avg, 6.0);
        assert.strictEqual(result.n, 1);
        assert.ok(Number.isFinite(result.hba1c));
    });

    test('calculates average from multiple values', () => {
        const result = calculate([
            { glucose_mmol_l: 5.5 },
            { glucose_mmol_l: 6.5 },
            { glucose_mmol_l: 7.0 }
        ]);
        assert.ok(result);
        assert.strictEqual(result.avg, (5.5 + 6.5 + 7.0) / 3);
        assert.strictEqual(result.n, 3);
    });

    test('filters out invalid values and uses only valid ones', () => {
        // Note: Number(null) === 0 in JavaScript, so null is coerced to 0 (valid).
        // undefined and non-numeric strings are filtered out by Number.isFinite.
        const result = calculate([
            { glucose_mmol_l: 6.0 },
            { glucose_mmol_l: undefined },
            { glucose_mmol_l: 'abc' },
            { glucose_mmol_l: 8.0 }
        ]);
        assert.ok(result);
        assert.strictEqual(result.n, 2);
        assert.strictEqual(result.avg, 7.0);
    });

    test('coerces string numeric values', () => {
        const result = calculate([
            { glucose_mmol_l: '6.0' },
            { glucose_mmol_l: '8.0' }
        ]);
        assert.ok(result);
        assert.strictEqual(result.n, 2);
        assert.strictEqual(result.avg, 7.0);
    });
});

describe('renderHbA1c', () => {
    test('renders card with HbA1c trend header', () => {
        const html = renderHbA1c([]);
        assert.ok(html.includes('🩸 Estimated HbA1c trend'));
    });

    test('renders "Not enough data" for empty data', () => {
        const html = renderHbA1c([]);
        assert.ok(html.includes('Not enough data'));
    });

    test('renders estimates for valid data', () => {
        const data = [
            { measured_at: new Date().toISOString(), glucose_mmol_l: 6.0 },
            { measured_at: new Date().toISOString(), glucose_mmol_l: 8.0 }
        ];
        const html = renderHbA1c(data);
        assert.ok(html.includes('mmol/mol'));
        assert.ok(html.includes('n=2'));
    });

    test('renders ADAG disclaimer text', () => {
        const html = renderHbA1c([]);
        assert.ok(html.includes('ADAG glucose-to-HbA1c relationship'));
    });
});

describe('installHbA1cTrend', () => {
    test('is a function', () => {
        assert.strictEqual(typeof installHbA1cTrend, 'function');
    });
});
