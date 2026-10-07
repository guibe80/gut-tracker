/*
 * timing-utils.js
 *
 * Timing offset calculations for glucose readings linked to meals.
 * Pure functions: no DOM, no Supabase, no external state except the
 * session-local timingOverrides map (used for per-meal preference recall).
 *
 * Loaded via <script> tag — all identifiers are globals.
 * Depends on nothing (standalone module).
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

// Maps each timing value to a minute offset from the meal timestamp.
// null means the timing is not meal-derived (no calculable offset).
const TIMING_OFFSETS = {
    fasting: null,          // Not derived from a specific meal
    before_meal: -30,      // 30 min before eating
    '30_min_after': 30,
    '1_hour_after': 60,
    '2_hours_after': 120,
    '3_hours_after': 180,
    bedtime: null,         // Not tied to a meal
    random: null,          // No meal relationship
    other: null            // User-defined, no default offset
};

// Default timing when a meal is newly selected in the glucose form.
const DEFAULT_MEAL_TIMING = '1_hour_after';

// Timing to revert to when a meal is cleared.
const DEFAULT_NO_MEAL_TIMING = 'random';

// In-memory store of user-overridden timing preferences, keyed by meal ID.
// This is session-scoped — preferences are not persisted to the database.
const timingOverrides = {};

/* ------------------------------------------------------------------ */
/* Core functions                                                     */
/* ------------------------------------------------------------------ */

// Return the minute offset for a timing value, or null if the timing
// has no meal-derived offset (e.g. "random", "bedtime").
function getTimingOffset(timing) {
    return TIMING_OFFSETS[timing] ?? null;
}

// Look up the preferred timing for a given meal.
// Returns a stored override if the user previously chose one in this
// session; otherwise returns the default timing.
function getPreferredTiming(mealId) {
    return timingOverrides[mealId] || DEFAULT_MEAL_TIMING;
}

// Record a user's timing preference for a meal (session-local only).
function setPreferredTiming(mealId, timing) {
    timingOverrides[mealId] = timing;
}

// Calculate a datetime (as a Date object) from a meal timestamp
// plus the offset for a given timing.
// Returns null if the timing has no meal-derived offset.
function calculateTime(mealTimeISO, timing) {
    const offset = getTimingOffset(timing);
    if (offset === null) return null;
    if (!mealTimeISO) return null;
    const base = new Date(mealTimeISO);
    if (isNaN(base.getTime())) return null;
    return new Date(base.getTime() + offset * 60000);
}

// Split a Date (or ISO string) into { date, time } for HTML form inputs.
// Reuses the same logic as utils/datetime.js localDateTime.
function splitDateTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    const pad = n => String(n).padStart(2, '0');
    return {
        date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}`
    };
}

// Given a meal record and a timing, produce the values that should be
// auto-populated into the glucose form's derived fields.
//
// Returns { date, time, timing, carbs, minutesFromMeal } or null if
// the timing has no meal-derived offset.
function applyMealTiming(meal, timing) {
    if (!meal || !meal.meal_time) return null;

    const calcDate = calculateTime(meal.meal_time, timing);
    if (!calcDate) return null;

    const parts = splitDateTime(calcDate);

    return {
        date: parts.date,
        time: parts.time,
        timing: timing,
        carbs: meal.estimated_carbohydrate_g ?? '',
        minutesFromMeal: getTimingOffset(timing) ?? ''
    };
}

// Clear a meal's stored timing override (if any).
// Called when the user clears the related-meal selection.
function clearMealTiming(mealId) {
    delete timingOverrides[mealId];
}
