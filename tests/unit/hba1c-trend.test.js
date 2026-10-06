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

const { toMmolMol, fmtEstimate, calculate, renderHbA1c, installHbA1cTrend, timingWeight } = sandbox;

describe('timingWeight', () => {
    test('returns correct weight for known timings', () => {
        assert.strictEqual(timingWeight('fasting'), 1.5);
        assert.strictEqual(timingWeight('before_meal'), 1.5);
        assert.strictEqual(timingWeight('2_hours_after'), 0.2);
    });

    test('returns default weight for unknown timing', () => {
        assert.strictEqual(timingWeight('unknown'), 1.0);
        assert.strictEqual(timingWeight(undefined), 1.0);
        assert.strictEqual(timingWeight(null), 1.0);
    });
});

describe('toMmolMol', () => {
    // ADAG formula: HbA1c(%) = (mean_glucose_mg/dL + 46.7) / 28.7
    // where mean_glucose_mg/dL = mmol/L * 18
    // HbA1c(mmol/mol) = (HbA1c(%) - 2.15) * 10.929

    test('converts mmol/L to HbA1c mmol/mol using ADAG formula', () => {
        const result = toMmolMol(6.0);
        // 6.0 mmol/L = 108 mg/dL → (108 + 46.7) / 28.7 = 5.40% → (5.40 - 2.15) * 10.929 = 35.6 mmol/mol
        const expectedPct = (108 + 46.7) / 28.7;
        const expected = (expectedPct - 2.15) * 10.929;
        assert.strictEqual(result, expected);
    });

    test('known conversion: 8.6 mmol/L (154.8 mg/dL)', () => {
        const result = toMmolMol(8.6);
        assert.ok(Number.isFinite(result));
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

    test('returns null when all values are invalid', () => {
        assert.strictEqual(calculate([{ glucose_mmol_l: null, timing: 'random' }, { glucose_mmol_l: undefined, timing: 'fasting' }]), null);
        assert.strictEqual(calculate([{ glucose_mmol_l: 'abc', timing: 'random' }]), null);
    });

    test('calculates from single valid value', () => {
        const result = calculate([{ glucose_mmol_l: 6.0, timing: 'random' }]);
        assert.ok(result);
        assert.strictEqual(result.avg, 6.0);
        assert.strictEqual(result.n, 1);
        assert.ok(Number.isFinite(result.hba1c));
    });

    test('calculates weighted average with timing', () => {
        const result = calculate([
            { glucose_mmol_l: 5.0, timing: 'fasting' },
            { glucose_mmol_l: 8.0, timing: '2_hours_after' }
        ]);
        assert.ok(result);
        // weighted avg = (5.0*1.5 + 8.0*0.2) / (1.5+0.2) = 5.353...
        assert.strictEqual(result.avg, (5.0*1.5 + 8.0*0.2) / (1.5 + 0.2));
        assert.strictEqual(result.n, 2);
    });

    test('fasting readings dominate weighted average', () => {
        const result = calculate([
            { glucose_mmol_l: 10.0, timing: '2_hours_after' },   // weight 0.2
            { glucose_mmol_l: 5.0, timing: 'fasting' },           // weight 1.5
        ]);
        assert.ok(result);
        // weighted avg = (10*0.2 + 5*1.5) / (0.2+1.5) = (2 + 7.5) / 1.7 = 5.71
        assert.ok(result.avg < 6.0, 'fasting reading should pull average toward 5.0');
    });

    test('filters out invalid values', () => {
        const result = calculate([
            { glucose_mmol_l: 6.0, timing: 'fasting' },
            { glucose_mmol_l: undefined, timing: 'random' },
            { glucose_mmol_l: 'abc', timing: 'random' },
            { glucose_mmol_l: 8.0, timing: 'random' }
        ]);
        assert.ok(result);
        assert.strictEqual(result.n, 2);
    });

    test('coerces string numeric values', () => {
        const result = calculate([
            { glucose_mmol_l: '6.0', timing: 'random' },
            { glucose_mmol_l: '8.0', timing: 'random' }
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
            { measured_at: new Date().toISOString(), glucose_mmol_l: 6.0, timing: 'fasting' },
            { measured_at: new Date().toISOString(), glucose_mmol_l: 8.0, timing: 'random' }
        ];
        const html = renderHbA1c(data);
        assert.ok(html.includes('mmol/mol'));
        assert.ok(html.includes('n=2'));
    });

    test('renders ADAG formula description', () => {
        const html = renderHbA1c([]);
        assert.ok(html.includes('ADAG glucose-to-HbA1c relationship'));
    });

    test('mentions timing-based weighting', () => {
        const html = renderHbA1c([]);
        assert.ok(html.includes('weighted'));
    });
});

describe('installHbA1cTrend', () => {
    test('is a function', () => {
        assert.strictEqual(typeof installHbA1cTrend, 'function');
    });
});
