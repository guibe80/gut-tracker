/*
 * Data mapping utilities for Gut + Glucose Tracker
 *
 * Helper functions for extracting and transforming data from
 * V2 backup JSON objects into normalized formats.
 */

// Extract the first non-null/undefined/empty value from an object
// using a list of possible property names.
function pick(obj, keys) {
    for (const k of keys) {
        if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
    }
    return null;
}

// Like pick(), but always returns an array.
// If the found value is an array, returns it directly.
// If it's a string, splits on commas/semicolons.
// Otherwise returns an empty array.
function pickArray(obj, keys) {
    const v = pick(obj, keys);
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') return v.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
    return [];
}

// Extract a timestamp from a V2 backup object.
// Checks multiple possible field names and returns an ISO string,
// or null if no valid timestamp is found.
function recordTime(o) {
    const direct = pick(o, ['timestamp', 'datetime', 'dateTime', 'createdAt', 'created_at']);
    if (direct) {
        const d = new Date(direct);
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    const d = pick(o, ['date', 'day']);
    const t = pick(o, ['time']);
    if (d) {
        const dt = new Date(`${d}T${t || '00:00'}`);
        if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    }
    return null;
}

// Convert a form field value to a number, or null if empty.
// Used by form submit handlers to normalize numeric input.
function num(v) {
    return v === '' || v == null ? null : Number(v);
}
