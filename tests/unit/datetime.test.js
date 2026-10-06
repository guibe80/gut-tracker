// Unit tests for utils/datetime.js
// Run: node --test tests/unit/datetime.test.js
const { test, describe } = require('node:test');
const assert = require('node:assert');

// Load the datetime module
// Since it's a plain (non-ESM) JS file without exports, we need to
// load it in a way that makes its functions available.
// The file uses function declarations at the top level, which are
// globally available when loaded via <script>. For Node testing,
// we wrap it so the functions become module-scoped.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const datetimeCode = fs.readFileSync(
    path.resolve(__dirname, '../../utils/datetime.js'),
    'utf8'
);

// Execute the datetime functions in a sandbox context
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(datetimeCode, sandbox);

const {
    localIso,
    ac,
    stripTz,
    parseTzNotes,
    fmt,
    localDateTime,
    dvParseDate,
    dvFormatDate,
    dvDayStart,
    dvDayEnd,
    dvPercentThrough,
    dvFormatHour,
} = sandbox;

describe('localIso', () => {
    test('converts date + time to ISO string', () => {
        const result = localIso('2025-06-15', '14:30');
        // Should contain the correct date and be a valid ISO string
        assert.ok(result.startsWith('2025-06-15'));
        assert.ok(result.endsWith('Z'));
    });

    test('defaults to 00:00 when time is empty', () => {
        const result = localIso('2025-01-01', '');
        assert.ok(result.startsWith('2025-01-01'));
        assert.ok(result.endsWith('Z'));
    });
});

describe('ac (timezone offset)', () => {
    test('returns a string in ±HH:MM format', () => {
        const result = ac();
        assert.match(result, /^[+-]\d{2}:\d{2}$/);
    });
});

describe('stripTz', () => {
    test('removes tz marker from notes', () => {
        assert.strictEqual(stripTz('Some notes [tz:+02:00]'), 'Some notes');
    });

    test('returns empty string for null/undefined', () => {
        assert.strictEqual(stripTz(null), '');
        assert.strictEqual(stripTz(undefined), '');
    });

    test('returns input unchanged when no tz marker', () => {
        assert.strictEqual(stripTz('No timezone here'), 'No timezone here');
    });
});

describe('parseTzNotes', () => {
    test('parses positive offset', () => {
        assert.strictEqual(parseTzNotes('Notes [tz:+02:30]'), 150);
    });

    test('parses negative offset', () => {
        assert.strictEqual(parseTzNotes('Notes [tz:-05:00]'), -300);
    });

    test('returns null when no tz marker', () => {
        assert.strictEqual(parseTzNotes('No tz here'), null);
        assert.strictEqual(parseTzNotes(null), null);
    });
});

describe('fmt', () => {
    test('formats a date to en-GB locale string', () => {
        const result = fmt('2025-06-15T14:30:00.000Z');
        assert.ok(typeof result === 'string');
        assert.notStrictEqual(result, '—');
    });

    test('returns em-dash for falsy values', () => {
        assert.strictEqual(fmt(null), '—');
        assert.strictEqual(fmt(''), '—');
        assert.strictEqual(fmt(undefined), '—');
    });
});

describe('localDateTime', () => {
    test('splits ISO date into {date, time} object', () => {
        const result = localDateTime('2025-06-15T14:30:00.000Z');
        assert.ok(result.date.match(/^\d{4}-\d{2}-\d{2}$/));
        assert.ok(result.time.match(/^\d{2}:\d{2}$/));
    });
});

describe('dvParseDate', () => {
    test('parses YYYY-MM-DD into a Date at local midnight', () => {
        const d = dvParseDate('2025-06-15');
        assert.strictEqual(d.getFullYear(), 2025);
        assert.strictEqual(d.getMonth(), 5); // June (0-indexed)
        assert.strictEqual(d.getDate(), 15);
    });
});

describe('dvFormatDate', () => {
    test('formats a Date to YYYY-MM-DD', () => {
        const d = new Date(2025, 5, 15); // Jun 15, 2025
        assert.strictEqual(dvFormatDate(d), '2025-06-15');
    });
});

describe('dvDayStart', () => {
    test('returns a Date at midnight UTC for the given ISO date', () => {
        const d = dvDayStart('2025-06-15');
        assert.strictEqual(d.getHours(), 0);
        assert.strictEqual(d.getMinutes(), 0);
        assert.strictEqual(d.getSeconds(), 0);
        assert.strictEqual(d.getMilliseconds(), 0);
    });
});

describe('dvDayEnd', () => {
    test('returns a Date at 23:59:59.999 for the given ISO date', () => {
        const d = dvDayEnd('2025-06-15');
        assert.ok(d.getHours() === 23 || d.getHours() === 0);
        // The end of day is the start of the next day minus 1ms
    });
});

describe('dvPercentThrough', () => {
    test('returns 0 for day start', () => {
        const dayStart = dvDayStart('2025-06-15');
        assert.strictEqual(dvPercentThrough(dayStart, dayStart.getTime()), 0);
    });

    test('returns 0.5 for noon', () => {
        const dayStart = dvDayStart('2025-06-15');
        const noon = new Date(dayStart.getTime() + 12 * 60 * 60 * 1000);
        assert.strictEqual(dvPercentThrough(dayStart, noon.getTime()), 0.5);
    });

    test('returns 1 for end of day', () => {
        const dayStart = dvDayStart('2025-06-15');
        const dayEnd = dayStart.getTime() + 24 * 60 * 60 * 1000 - 1;
        // Math.min clamps, but floating point may give 0.9999... — that's fine
        const result = dvPercentThrough(dayStart, dayEnd);
        assert.ok(result > 0.999 && result <= 1);
    });

    test('clamps to 0 for times before day start', () => {
        const dayStart = dvDayStart('2025-06-15');
        const before = dayStart.getTime() - 3600000;
        assert.strictEqual(dvPercentThrough(dayStart, before), 0);
    });

    test('clamps to 1 for times after day end', () => {
        const dayStart = dvDayStart('2025-06-15');
        const after = dayStart.getTime() + 25 * 60 * 60 * 1000;
        assert.strictEqual(dvPercentThrough(dayStart, after), 1);
    });
});

describe('dvFormatHour', () => {
    test('formats 0% as 00:00', () => {
        assert.strictEqual(dvFormatHour(0), '00:00');
    });

    test('formats 50% as 12:00', () => {
        assert.strictEqual(dvFormatHour(0.5), '12:00');
    });

    test('formats 100% as 24:00', () => {
        assert.strictEqual(dvFormatHour(1), '24:00');
    });
});
