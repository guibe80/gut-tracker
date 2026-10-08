/*
 * services/data-service.js
 *
 * Supabase data access layer: pagination, loading, insert/update with
 * schema-fallback retry logic, save dispatch, and delete.
 *
 * Depends on globals from utils/ (loaded as <script> before this file):
 *   - supabaseClient, user       (set up by index.html)
 *   - page, pageSize, totals     (pagination state, set by index.html)
 *   - meals, glucose, symptoms,  (data arrays, set by index.html)
 *     bowels, weights, mealFoods
 *   - setSync, setMsg, render     (UI callbacks, set by index.html)
 *   - editState                  (form editing state, set by index.html)
 *
 * Depends on utils/supabase-helpers.js:
 *   - missingColumn, isNetworkError, wait
 *
 * Pure logic in insertWithSchemaFallback / updateWithSchemaFallback
 * (meal_type → 'other' fallback, column-stripping fallback) is
 * testable via the unit tests in tests/unit/data-service.test.js.
 */

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

async function loadPage(table, orderColumn, pageName) {
    const from = page[pageName] * pageSize[pageName], to = from + pageSize[pageName] - 1;
    const result = await supabaseClient.from(table).select('*', { count: 'exact' }).order(orderColumn, { ascending: false }).range(from, to);
    if (result.error) throw result.error;
    totals[pageName] = result.count || 0;
    return result.data || [];
}

/* ------------------------------------------------------------------ */
/* Table-specific loaders with schema-error tolerance                 */
/* ------------------------------------------------------------------ */

async function loadGlucose() {
    try {
        return await loadPage('glucose_readings', 'measured_at', 'glucose');
    } catch (error) {
        if (/glucose_readings.*(measured_at|reading_time|does not exist|schema cache)|relation .*glucose_readings.*does not exist/i.test(error.message || '')) {
            totals.glucose = 0;
            return [];
        }
        throw error;
    }
}

async function loadWeights() {
    try {
        return await loadPage('weight_entries', 'measured_at', 'weights');
    } catch (error) {
        if (/weight_entries.*(measured_at|does not exist|schema cache)|relation .*weight_entries.*does not exist/i.test(error.message || '')) {
            totals.weights = 0;
            return [];
        }
    throw error;
    }
}

async function loadWaterEntries() {
    try {
        if (!supabaseClient) { setSync('error', 'Supabase client not configured'); return []; }
        const { data, error } = await supabaseClient
            .from('water_intake')
            .select('*')
            .eq('user_id', user.id)
            .order('consumed_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (error) {
        if (/water_intake.*(does not exist|schema cache)|relation .*water_intake.*does not exist/i.test(error.message || '')) {
            return [];
        }
        throw error;
    }
}

/* ------------------------------------------------------------------ */
/* Bulk load                                                           */
/* ------------------------------------------------------------------ */

async function load() {
    setSync('syncing');
    try {
        const [m, g, s, b, w] = await Promise.all([
            loadPage('meals', 'meal_time', 'meals'),
            loadGlucose(),
            loadPage('gut_symptoms', 'occurred_at', 'symptoms'),
            loadPage('bowel_movements', 'occurred_at', 'bowels'),
            loadWeights(),
            loadWaterEntries()
        ]);
        for (const name of Object.keys(pageSize))
            page[name] = Math.min(page[name], Math.max(0, Math.ceil(totals[name] / pageSize[name]) - 1));
        const mealIds = m.map(meal => meal.id);
        const mf = mealIds.length
            ? await supabaseClient.from('meal_foods').select('*').in('meal_id', mealIds)
            : { data: [], error: null };
        if (mf.error) throw mf.error;
        meals = m;
        glucose = g;
        symptoms = s;
        bowels = b;
        weights = w;
        waterIntake = wi || [];
        mealFoods = mf.data || [];
        render();
        setSync('connected');
    } catch (error) {
        setSync('error');
        throw error;
    }
}

/* ------------------------------------------------------------------ */
/* Insert / Update with schema-fallback retry                          */
/* ------------------------------------------------------------------ */

async function insertWithSchemaFallback(table, payload) {
    let remaining = { ...payload };
    for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
        let result;
        for (let networkAttempt = 0; networkAttempt < 3; networkAttempt++) {
            try {
                result = await supabaseClient.from(table).insert(remaining).select().single();
                break;
            } catch (error) {
                if (!isNetworkError(error) || networkAttempt === 2) throw error;
                await wait(500 * (networkAttempt + 1));
            }
        }
        if (!result.error) return result.data;
        const message = String(result.error.message || '');
        if (table === 'meals' && remaining.meal_type && /meals_meal_type_check/i.test(message) && remaining.meal_type !== 'other') {
            remaining.meal_type = 'other';
            remaining.notes = [remaining.notes, `Original meal type: ${payload.meal_type}`].filter(Boolean).join(' · ');
            continue;
        }
        const column = missingColumn(result.error);
        if (!column || !(column in remaining)) throw result.error;
        delete remaining[column];
    }
    throw new Error(`Unable to insert into ${table}`);
}

async function updateWithSchemaFallback(table, id, payload) {
    let remaining = { ...payload };
    for (let attempt = 0; attempt <= Object.keys(payload).length; attempt++) {
        let result;
        for (let networkAttempt = 0; networkAttempt < 3; networkAttempt++) {
            try {
                result = await supabaseClient.from(table).update(remaining).eq('id', id).eq('user_id', user.id).select().single();
                break;
            } catch (error) {
                if (!isNetworkError(error) || networkAttempt === 2) throw error;
                await wait(500 * (networkAttempt + 1));
            }
        }
        if (!result.error) return result.data;
        const column = missingColumn(result.error);
        if (!column || !(column in remaining)) throw result.error;
        delete remaining[column];
    }
    throw new Error(`Unable to update ${table}`);
}

/* ------------------------------------------------------------------ */
/* Save dispatch (insert vs update)                                    */
/* ------------------------------------------------------------------ */

async function save(table, payload, msgId) {
    setSync('syncing');
    try {
        let data;
        if (editState?.table === table) {
            data = await updateWithSchemaFallback(table, editState.id, payload);
            setFormMode({ meals: 'foodForm', glucose_readings: 'glucoseForm', gut_symptoms: 'symForm', bowel_movements: 'bowelForm', weight_entries: 'weightForm' }[table], false);
            editState = null;
        } else {
            data = await insertWithSchemaFallback(table, { ...payload, user_id: user.id });
        }
        setMsg(msgId, 'Saved to cloud.', 'ok');
        await load();
        return data;
    } catch (error) {
        setSync('error');
        throw error;
    }
}

async function saveSilent(table, payload) {
    setSync('syncing');
    try {
        return await insertWithSchemaFallback(table, { ...payload, user_id: user.id });
    } catch (error) {
        setSync('error');
        throw error;
    }
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

async function deleteEntry(table, id) {
    if (!id || !confirm('Delete this entry?')) return;
    setSync('syncing');
    try {
        if (table === 'meals') {
            const foodResult = await supabaseClient.from('meal_foods').delete().eq('meal_id', id);
            if (foodResult.error) throw foodResult.error;
            await removeWaterFromMeal?.(id);
        }
        let request = supabaseClient.from(table).delete().eq('id', id);
        if (table !== 'meal_foods') request = request.eq('user_id', user.id);
        const result = await request;
        if (result.error) throw result.error;
        await load();
    } catch (error) {
        setSync('error', error.message);
        setMsg('fs', 'Delete failed: ' + error.message, 'err');
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
