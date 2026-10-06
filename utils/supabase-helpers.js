/*
 * Supabase helper utilities for Gut + Glucose Tracker
 *
 * Pure utility functions used by the Supabase data layer for error
 * handling, schema fallback, and retry logic.
 */

// Extract the missing column name from a Supabase schema cache error.
// Returns the column name, or null if the error is not a missing-column error.
function missingColumn(error) {
    const match = String(error?.message || '').match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
    return match?.[1] || null;
}

// Test whether an error is a network-level failure (vs. a Supabase API error).
// Used by retry logic in insertWithSchemaFallback / updateWithSchemaFallback.
function isNetworkError(error) {
    return error instanceof TypeError || /networkerror|failed to fetch|fetch failed|load failed|network request failed/i.test(String(error?.message || error));
}

// Promise-based delay for retry backoff.
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
