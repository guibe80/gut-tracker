/*
 * services/v2-import.js
 *
 * V2 backup import logic: parses a V2 JSON backup, deduplicates against
 * existing data, and inserts meals, symptoms, and bowel records.
 *
 * Depends on globals from utils/ (loaded via <script> tags before this file):
 *   - recordTime, pick, pickArray          (utils/data-mapping.js)
 *   - supportedMealType                   (utils/validation.js)
 *
 * Depends on services/data-service.js:
 *   - saveSilent, insertWithSchemaFallback (insert operations)
 *   - load                                (reload after import)
 *
 * V2 migration dedup helpers (getMigrationState, hasImportedFood,
 * hasImportedSymptom, hasImportedBowel) are co-located in this file.
 *
 * Depends on globals from index.html:
 *   - setMsg, setSync                     (UI messaging)
 *   - user                                (auth state)
 *
 * Exports: importV2Backup(file) — async function that takes a File object
 * from an <input type="file"> change event and processes the V2 backup.
 */

async function importV2Backup(file) {
    if (!file) return;
    setMsg('migration', 'Reading V2 backup…');
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (Number(data.version) !== 2) {
            throw new Error('This does not look like a V2 Gut Tracker JSON backup (version 2 expected).');
        }
        const foods = Array.isArray(data.foods) ? data.foods : [];
        const syms = Array.isArray(data.symptoms) ? data.symptoms : [];
        const migrationState = await getMigrationState();
        let mealCount = 0, foodCount = 0, symCount = 0, bowelCount = 0, skipped = 0, duplicateMealCount = 0, duplicateSymptomCount = 0, duplicateBowelCount = 0;

        for (const f of foods) {
            const dt = recordTime(f);
            if (!dt) { skipped++; continue; }
            const originalMealType = pick(f, ['mealType', 'meal_type', 'meal', 'type']) || 'Other';
            const normalizedMealType = supportedMealType(originalMealType);
            const foodName = String(pick(f, ['foods', 'food', 'whatDidYouEat', 'what', 'description']) || 'Unspecified');
            if (hasImportedFood(migrationState, f, dt, normalizedMealType, foodName)) { duplicateMealCount++; continue; }
            const marker = `[V2 migration:food:${f.id ?? dt}]`;
            const meal = await saveSilent('meals', {
                meal_time: dt,
                meal_type: normalizedMealType,
                estimated_carbohydrate_g: null,
                protein_estimate_g: null,
                notes: [f.notes, f.portion ? `V2 portion: ${f.portion}` : '', originalMealType.toLowerCase() === normalizedMealType ? '' : `V2 meal type: ${originalMealType}`].filter(Boolean).concat(marker).join(' · ')
            });
            const triggers = pickArray(f, ['triggers', 'potentialTriggers', 'potential_triggers']);
            await insertWithSchemaFallback('meal_foods', {
                meal_id: meal.id, user_id: user.id, food_name: foodName,
                notes: [triggers.length ? 'V2 triggers: ' + triggers.join(', ') : '', marker].filter(Boolean).join(' · ')
            });
            migrationState.meals.push({ id: meal.id, meal_time: dt, meal_type: normalizedMealType, notes: marker });
            mealCount++;
            foodCount++;
        }

        for (const s of syms) {
            const dt = recordTime(s);
            if (!dt) { skipped++; continue; }
            const mealId = null;
            for (const [field, type] of [['bloat', 'bloating'], ['bloating', 'bloating'], ['pain', 'abdominal_pain'], ['abdominalPain', 'abdominal_pain'], ['gas', 'gas'], ['urgency', 'urgency']]) {
                if (s[field] !== undefined && s[field] !== null && s[field] !== '') {
                    const severity = Number(s[field]) || 0;
                    if (hasImportedSymptom(migrationState, s, field, dt, type, severity)) { duplicateSymptomCount++; continue; }
                    const marker = `[V2 migration:symptom:${s.id ?? dt}:${field}]`;
                    await insertWithSchemaFallback('gut_symptoms', {
                        user_id: user.id, occurred_at: dt, symptom_type: type, severity,
                        duration_minutes: null, meal_id: mealId, notes: marker
                    });
                    symCount++;
                    migrationState.symptoms.push({ occurred_at: dt, symptom_type: type, severity, notes: marker });
                }
            }
            const br = pick(s, ['bristol', 'bristolType', 'bristol_type', 'stoolType', 'stool']);
            if (br !== undefined && br !== null && br !== '') {
                const bristol = Number(String(br).split(' ')[0]);
                if (!hasImportedBowel(migrationState, s, dt, bristol)) {
                    const marker = `[V2 migration:bowel:${s.id ?? dt}]`;
                    await insertWithSchemaFallback('bowel_movements', {
                        user_id: user.id, occurred_at: dt, bristol_type: bristol,
                        urgency: Number(s.urgency) || 0, completeness: null, difficulty: null, straining: false, notes: marker
                    });
                    migrationState.bowels.push({ occurred_at: dt, bristol_type: bristol, notes: marker });
                    bowelCount++;
                } else {
                    duplicateBowelCount++;
                }
            }
        }

        setMsg('migration',
            `V2 import complete: ${mealCount} meals, ${foodCount} food records, ${symCount} symptom records, ${bowelCount} bowel records` +
            (duplicateMealCount ? ' · ' + duplicateMealCount + ' meals skipped' : '') +
            (duplicateSymptomCount ? ' · ' + duplicateSymptomCount + ' symptoms skipped' : '') +
            (duplicateBowelCount ? ' · ' + duplicateBowelCount + ' bowel records skipped' : '') +
            (skipped ? ' · ' + skipped + ' records skipped because they had no usable date/time.' : ''),
            'ok'
        );
        await load();
    } catch (err) {
        try {
            await load();
            setMsg('migration', 'Import failed: ' + err.message + ' Cloud connection is available.', 'err');
        } catch (loadError) {
            setSync('error', loadError.message);
            setMsg('migration', 'Import failed: ' + err.message, 'err');
        }
    }
}

/* ------------------------------------------------------------------ */
/* V2 migration dedup helpers                                          */
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

/* ------------------------------------------------------------------ */
/* V3 Export                                                           */
/* ------------------------------------------------------------------ */

function exportV3Backup() {
    const out = {
        version: 3,
        exportedAt: new Date().toISOString(),
        meals,
        meal_foods: mealFoods,
        glucose_readings: glucose,
        gut_symptoms: symptoms,
        bowel_movements: bowels,
        weight_entries: weights
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gut-tracker-v3-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
}
