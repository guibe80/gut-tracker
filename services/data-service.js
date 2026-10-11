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
        if (!user) return [];
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
        if (error instanceof TypeError) return [];
        console.warn('[loadWaterEntries] Supabase query failed — returning empty:', error.message);
        return [];
    }
}

/* ------------------------------------------------------------------ */
/* Bulk load                                                           */
/* ------------------------------------------------------------------ */

async function load() {
    setSync('syncing');
    try {
        const [m, g, s, b, w, wi] = await Promise.all([
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
    if (!supabaseClient) { setSync('error', 'Supabase client not configured'); return; }
    if (!user) { setSync('error', 'Not logged in'); return; }
    const msgTarget = { meals: 'fs', glucose_readings: 'gs', gut_symptoms: 'sts', bowel_movements: 'bs', weight_entries: 'ws' }[table] || 'fs';
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
        const msg = error?.message || String(error);
        console.warn('[deleteEntry]', table, id, msg);
        setSync('error', msg);
        setMsg(msgTarget, 'Delete failed: ' + msg, 'err');
    }
}
