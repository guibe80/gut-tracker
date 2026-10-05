/*
 * DateTime utilities for Gut + Glucose Tracker
 *
 * All functions in this module are pure — no DOM access, no Supabase,
 * no external state. They are extracted from index.html to enable
 * unit testing and reduce the size of the main application file.
 */

// Convert date + time input values to an ISO string.
// If time is empty, defaults to 00:00.
function localIso(date, time) {
    return new Date(`${date}T${time || '00:00'}`).toISOString();
}

// Return the local timezone offset as a string like '+01:00' or '-05:00'.
function ac() {
    const off = new Date().getTimezoneOffset();
    const sign = off <= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return sign + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0');
}

// Remove a trailing '[tz:±HH:MM]' marker from notes text.
function stripTz(notes) {
    if (!notes) return '';
    return String(notes).replace(/ \[tz:[+-]\d{2}:\d{2}\]$/, '');
}

// Parse a trailing '[tz:±HH:MM]' marker from notes text and return
// the offset in minutes (negative for east of UTC).
// Returns null if no marker is found.
function parseTzNotes(notes) {
    if (!notes) return null;
    const m = String(notes).match(/ \[tz:([+-])(\d{2}):(\d{2})\]$/);
    if (!m) return null;
    return (m[1] === '+' ? 1 : -1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// Format a date value (ISO string, Date, or null/empty) as a localized
// en-GB string, or '—' if the value is falsy.
function fmt(v) {
    return v ? new Date(v).toLocaleString('en-GB') : '—';
}

// Split a datetime value (ISO string or Date) into {date, time} fields
// for use in HTML date/time input elements.
function localDateTime(value) {
    const date = new Date(value);
    const pad = number => String(number).padStart(2, '0');
    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
    };
}

/*
 * Day-view date helpers
 */

// Parse an ISO date string (YYYY-MM-DD) into a local Date at midnight.
function dvParseDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d);
}

// Format a Date as an ISO date string (YYYY-MM-DD).
function dvFormatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Get the start of the day (00:00:00.000) for a given ISO date string.
function dvDayStart(isoDate) {
    const d = dvParseDate(isoDate);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Get the end of the day (23:59:59.999) for a given ISO date string.
function dvDayEnd(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    d.setMilliseconds(-1);
    return d;
}

// Return a value between 0 and 1 representing how far through the day
// an event time falls (0 = midnight, 1 = end of day).
function dvPercentThrough(dayStart, eventTime) {
    const span = 86400000;
    return Math.max(0, Math.min(1, (new Date(eventTime).getTime() - dayStart.getTime()) / span));
}

// Format a percentage of a day as 'HH:MM'.
function dvFormatHour(pct) {
    const totalMinutes = Math.round(pct * 1440);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
