/*
 * HTML utility functions for Gut + Glucose Tracker
 *
 * Pure functions for safe DOM manipulation and HTML generation.
 */

// HTML-escape a value for safe insertion into HTML.
// Escapes & < > ' " to their HTML entity equivalents.
function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[c]));
}
