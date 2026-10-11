/*
 * services/migration.js
 *
 * V2 backup migration dedup helpers: loads the user's existing records
 * from Supabase and answers "has this V2 source record already been
 * imported?" for foods, symptoms, and bowel movements.
 *
 * These helpers are intentionally free of insert/update side effects —
 * they only read. The insert orchestration stays in services/v2-import.js.
 *
 * Depends on globals from utils/ (loaded via <script> tags before this file):
 *   - none (pure query + comparison logic)
 *
 * Depends on services/data-service.js:
 *   - none directly (this module queries Supabase itself)
 *
 * Depends on globals from index.html:
 *   - supabaseClient   (auth state)
 *
 * Exports:
 *   - getMigrationState()             — async; loads existing meals/foods/symptoms/bowels
 *   - hasImportedFood(state, ...)     — boolean dedup check
 *   - hasImportedSymptom(state, ...)  — boolean dedup check
 *   - hasImportedBowel(state, ...)    — boolean dedup check
 *
 * Dedup strategy (two tiers):
 *   1. Exact source marker — `[V2 migration:<kind>:<sourceId>]` embedded in notes.
 *      Fast, unambiguous, survives re-imports.
 *   2. Fallback field match — same timestamp + type/value + any existing
 *      `[V2 migration]` marker. Used when the source record had no id.
 */

/* ------------------------------------------------------------------ */
/* Migration state loading                                             */
/* ------------------------------------------------------------------ */

async function getMigrationState() {
    const [mealResult, foodResult, symptomResult, bowelResult] = await Promise.all([
        supabaseClient.from('meals').select('id,meal_time,meal_type,notes'),
        supabaseClient.from('meal_foods').select('meal_id,food_name,notes'),
        supabaseClient.from('gut_symptoms').select('id,occurred_at,symptom_type,severity,notes'),
        supabaseClient.from('bowel_movements').select('id,occurred_at,bristol_type,notes')
    ]);
    if (mealResult.error) throw mealResult.error;
    if (foodResult.error) throw foodResult.error;
    if (symptomResult.error) throw symptomResult.error;
    if (bowelResult.error) throw bowelResult.error;
    return { meals: mealResult.data || [], foods: foodResult.data || [], symptoms: symptomResult.data || [], bowels: bowelResult.data || [] };
}

/* ------------------------------------------------------------------ */
/* Dedup checks                                                        */
/* ------------------------------------------------------------------ */

function hasImportedFood(state, source, dt, mealType, foodName) {
    const sourceMarker = `[V2 migration:food:${source.id ?? dt}]`;
    if (state.meals.some(meal => String(meal.notes || '').includes(sourceMarker))) return true;
    return state.meals.some(meal => meal.meal_time === dt && meal.meal_type === mealType && String(meal.notes || '').includes('[V2 migration]') && state.foods.some(food => food.meal_id === meal.id && food.food_name === foodName && String(food.notes || '').includes('[V2 migration]')));
}

function hasImportedSymptom(state, source, field, dt, type, severity) {
    const sourceMarker = `[V2 migration:symptom:${source.id ?? dt}:${field}]`;
    if (state.symptoms.some(symptom => String(symptom.notes || '').includes(sourceMarker))) return true;
    return state.symptoms.some(symptom => symptom.occurred_at === dt && symptom.symptom_type === type && Number(symptom.severity || 0) === severity && String(symptom.notes || '').includes('[V2 migration]'));
}

function hasImportedBowel(state, source, dt, bristol) {
    const sourceMarker = `[V2 migration:bowel:${source.id ?? dt}]`;
    if (state.bowels.some(bowel => String(bowel.notes || '').includes(sourceMarker))) return true;
    return state.bowels.some(bowel => bowel.occurred_at === dt && Number(bowel.bristol_type) === Number(bristol) && String(bowel.notes || '').includes('[V2 migration]'));
}