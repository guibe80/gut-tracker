/*
 * Validation utilities for Gut + Glucose Tracker
 *
 * Pure functions for validating and normalising user input against
 * known Supabase enum values and constraints.
 */

// Normalise a meal type string to one of the valid enum values.
// Returns 'other' if the value doesn't match a known type.
function supportedMealType(value) {
    const type = String(value || '').trim().toLowerCase();
    return ['breakfast', 'lunch', 'dinner', 'snack', 'drink', 'other'].includes(type) ? type : 'other';
}
