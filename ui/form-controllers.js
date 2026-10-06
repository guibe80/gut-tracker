/*
 * ui/form-controllers.js
 *
 * Form state management, form submit handlers, event wiring for
 * pagination, timeline controls, tab navigation, import/export,
 * sync, and authentication.
 *
 * Loaded AFTER all utils, services, and ui/ modules, but BEFORE
 * @supabase/supabase-js and the inline app shell script.
 * All identifiers below are globals (function declarations,
 * const/let in the inline <script> block, or window.supabase).
 */

/* ------------------------------------------------------------------ */
/* Form state                                                          */
/* ------------------------------------------------------------------ */

let editState = null;

function setFormMode(formId, editing) {
    const form = $(formId);
    const button = form?.querySelector('button.primary');
    if (button) button.textContent = editing ? button.dataset.updateLabel : button.dataset.saveLabel;
}

function openEditForm(table, id) {
    const record = ({
        meals, glucose, symptoms, bowels, weights
    }[({ meals: 'meals', glucose_readings: 'glucose', gut_symptoms: 'symptoms', bowel_movements: 'bowel', weight_entries: 'weights' }[table])] || []).find(item => item.id === id);
    if (!record) return;
    const tab = { meals: 'food', glucose_readings: 'glucose', gut_symptoms: 'symptoms', bowel_movements: 'bowel', weight_entries: 'weight' }[table];
    const fields = localDateTime(record.meal_time || record.measured_at || record.occurred_at);
    document.querySelector(`.tab[data-tab="${tab}"]`)?.click();
    editState = { table, id };
    setFormMode(tab + 'Form', true);
    if (table === 'meals') {
        const mealFoodRows = mealFoods.filter(food => food.meal_id === id);
        const mealTags = mealFoodRows.map(food => food.notes || '').join(' ');
        $('fd').value = fields.date;
        $('ft').value = fields.time;
        $('fm').value = (record.meal_type || 'other').replace(/^./, character => character.toUpperCase());
        $('fcg').value = record.estimated_carbohydrate_g ?? '';
        $('fpg').value = record.protein_estimate_g ?? '';
        $('ffg').value = record.fibre_estimate_g ?? '';
        $('foods').value = mealFoodRows.map(food => food.food_name).filter(Boolean).join(', ');
        $('fn').value = record.notes || '';
        document.querySelectorAll('#foodForm input[type=checkbox]').forEach(input => { input.checked = mealTags.includes(input.value) });
    }
    if (table === 'glucose_readings') {
        $('gd').value = fields.date;
        $('gt').value = fields.time;
        $('gv').value = record.glucose_mmol_l ?? '';
        $('gtime').value = record.timing || 'random';
        $('gm').value = record.meter_name || '';
        $('gmeal').value = record.meal_id || '';
        $('gctx').value = record.context || 'normal';
        $('gmin').value = record.minutes_from_meal ?? '';
        $('gcg').value = record.estimated_meal_carbs_g ?? '';
        $('gn').value = record.notes || '';
    }
    if (table === 'gut_symptoms') {
        $('sd').value = fields.date;
        $('st').value = fields.time;
        $('stype').value = record.symptom_type || 'other';
        $('sev').value = record.severity ?? 0;
        $('dur').value = record.duration_minutes ?? '';
        $('smeal').value = record.meal_id || '';
        $('sn').value = record.notes || '';
    }
    if (table === 'bowel_movements') {
        $('bd').value = fields.date;
        $('bt').value = fields.time;
        $('br').value = record.bristol_type || 4;
        $('bu').value = record.urgency ?? 0;
        $('bc').value = record.completeness ?? 10;
        $('bdi').value = record.difficulty ?? 0;
        $('bst').value = String(record.straining) === 'true' ? 'true' : 'false';
        $('bn').value = record.notes || '';
    }
    if (table === 'weight_entries') {
        $('wd').value = fields.date;
        $('wt').value = fields.time;
        $('wv').value = record.weight_kg ?? '';
        $('wn').value = record.notes || '';
    }
    document.getElementById(tab + 'Form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/* Form submit handlers                                                 */
/* ------------------------------------------------------------------ */

function bindFormHandlers() {
    $('foodForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!user) return;
        try {
            const editingMealId = editState?.table === 'meals' ? editState.id : null;
            const mealType = $('fm').value, normalizedMealType = supportedMealType(mealType);
            const meal = await save('meals', {
                meal_time: localIso($('fd').value, $('ft').value),
                meal_type: normalizedMealType,
                estimated_carbohydrate_g: num($('fcg').value),
                protein_estimate_g: num($('fpg').value),
                fibre_estimate_g: num($('ffg').value),
                notes: [$('fn').value.trim(), $('fp').value !== 'Normal' ? `Portion: ${$('fp').value}` : '', mealType.toLowerCase() === normalizedMealType ? '' : `Original meal type: ${mealType}`].filter(Boolean).join(' · ')
            }, 'fs');
            const foods = $('foods').value.trim();
            const triggers = [...document.querySelectorAll('#foodForm input[type=checkbox]:checked')].map(x => x.value);
            if (editingMealId) {
                const foodDelete = await supabaseClient.from('meal_foods').delete().eq('meal_id', editingMealId);
                if (foodDelete.error) throw foodDelete.error;
            }
            if (foods || triggers.length) {
                await insertWithSchemaFallback('meal_foods', {
                    meal_id: meal.id, user_id: user.id, food_name: foods || 'Unspecified',
                    notes: triggers.length ? 'Triggers: ' + triggers.join(', ') : null
                });
            }
            $('foodForm').reset();
            reset();
            setMsg('fs', 'Meal saved to cloud.', 'ok');
            await load();
        } catch (err) {
            setMsg('fs', err.message, 'err');
        }
    });

    $('glucoseForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await save('glucose_readings', {
                measured_at: localIso($('gd').value, $('gt').value),
                glucose_mmol_l: Number($('gv').value),
                timing: $('gtime').value,
                meter_name: $('gm').value.trim() || null,
                meal_id: $('gmeal').value || null,
                context: $('gctx').value,
                minutes_from_meal: num($('gmin').value),
                estimated_meal_carbs_g: num($('gcg').value),
                notes: $('gn').value.trim() || null
            }, 'gs');
            $('glucoseForm').reset();
            reset();
        } catch (err) {
            setMsg('gs', err.message, 'err');
        }
    });

    $('symForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await save('gut_symptoms', {
                occurred_at: localIso($('sd').value, $('st').value),
                symptom_type: $('stype').value,
                severity: Number($('sev').value || 0),
                duration_minutes: num($('dur').value),
                meal_id: $('smeal').value || null,
                notes: $('sn').value.trim() || null
            }, 'sts');
            $('symForm').reset();
            reset();
        } catch (err) {
            setMsg('sts', err.message, 'err');
        }
    });

    $('bowelForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await save('bowel_movements', {
                occurred_at: localIso($('bd').value, $('bt').value),
                bristol_type: Number($('br').value),
                urgency: Number($('bu').value || 0),
                completeness: Number($('bc').value || 0),
                difficulty: Number($('bdi').value || 0),
                straining: $('bst').value === 'true',
                notes: $('bn').value.trim() || null
            }, 'bs');
            $('bowelForm').reset();
            reset();
        } catch (err) {
            setMsg('bs', err.message, 'err');
        }
    });

    $('weightForm').addEventListener('submit', async e => {
        e.preventDefault();
        if (!user) return;
        try {
            await save('weight_entries', {
                measured_at: localIso($('wd').value, $('wt').value),
                weight_kg: Number($('wv').value),
                notes: $('wn').value.trim() || null
            }, 'ws');
            $('weightForm').reset();
            reset();
        } catch (err) {
            setMsg('ws', err.message, 'err');
        }
    });
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                       */
/* ------------------------------------------------------------------ */

function bindEventHandlers() {
    // Form clear buttons
    for (const [id, form] of [['fclear', 'foodForm'], ['gclear', 'glucoseForm'], ['sclear', 'symForm'], ['bclear', 'bowelForm'], ['wclear', 'weightForm']]) {
        $(id).onclick = () => { editState = null; setFormMode(form, false); $(form).reset(); reset() };
    }

    // Tab switching
    document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.pane').forEach(x => x.classList.add('hidden'));
        btn.classList.add('active');
        $(btn.dataset.tab).classList.remove('hidden');
    });

    // List entry actions (edit/delete)
    ['flist', 'glist', 'slist', 'blist', 'wlist'].forEach(id => {
        $(id).onclick = event => {
            const editButton = event.target.closest('[data-edit-table]');
            if (editButton) { openEditForm(editButton.dataset.editTable, editButton.dataset.editId); return; }
            const deleteButton = event.target.closest('[data-delete-table]');
            if (deleteButton) deleteEntry(deleteButton.dataset.deleteTable, deleteButton.dataset.deleteId);
        };
    });

    // Pagination controls
    document.querySelectorAll('[data-page-size]').forEach(control => {
        control.onchange = () => {
            const name = control.dataset.pageSize;
            page[name] = 0;
            pageSize[name] = Number(control.value);
            load().catch(error => setSync('error', error.message));
        };
    });
    document.querySelectorAll('[data-page-prev], [data-page-next]').forEach(control => {
        control.onclick = () => {
            const name = control.dataset.pagePrev || control.dataset.pageNext;
            const direction = control.dataset.pagePrev ? -1 : 1;
            page[name] = Math.max(0, page[name] + direction);
            load().catch(error => setSync('error', error.message));
        };
    });

    // Timeline controls
    $('timelineFilter').onchange = () => { timelinePage = 0; render() };
    $('timelinePageSize').onchange = () => { timelinePageSize = Number($('timelinePageSize').value); timelinePage = 0; render() };
    $('timelinePrev').onclick = () => { timelinePage = Math.max(0, timelinePage - 1); render() };
    $('timelineNext').onclick = () => { timelinePage++; render() };

    // Import/export
    $('imp').addEventListener('change', async e => { await importV2Backup(e.target.files?.[0]); e.target.value = ''; });
    $('export').onclick = () => exportV3Backup();

    // Sign out
    $('signout').onclick = async () => { await supabaseClient.auth.signOut(); location.reload() };

    // Check for PWA update
    $('checkUpdate').onclick = async () => {
        const msg = $('updateMsg');
        msg.textContent = 'Checking…'; msg.className = 'muted';
        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                let updated = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => { updated = true; msg.textContent = 'Updating…'; location.reload() }, { once: true });
                reg.update();
                setTimeout(() => { if (!updated) { msg.textContent = 'Already up to date.'; msg.className = 'muted ok' } }, 10000);
            } else {
                msg.textContent = 'No SW — forcing network reload…'; msg.className = 'muted';
                location.href = location.pathname + '?v=' + Date.now();
            }
        } catch (e) {
            msg.textContent = 'Update check failed — retrying…'; msg.className = 'muted';
            setTimeout(() => { location.href = location.pathname + '?v=' + Date.now() }, 500);
        }
    };

    // Sync button
    $('sync').onclick = reconnectAndReload;

    // GitHub OAuth sign-in
    $('github').onclick = async () => {
        if (!setupClient()) {
            setMsg('authmsg', 'Supabase publishable key is missing or invalid. Open setup.html and enter the key from Supabase Project Settings → API.', 'err');
            return;
        }
        setMsg('authmsg', 'Opening GitHub sign-in…');
        const redirectTo = DV_REDIRECT || window.location.origin + window.location.pathname;
        console.log('[auth] redirectTo:', redirectTo);
        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } });
            if (error) setMsg('authmsg', 'GitHub sign-in failed: ' + error.message, 'err');
        } catch (err) {
            setMsg('authmsg', 'GitHub sign-in failed: ' + (err?.message || err), 'err');
        }
    };

    // Email/password sign-in
    $('login').onclick = async () => {
        if (!setupClient()) {
            setMsg('authmsg', 'Supabase publishable key is not configured. Open setup.html first.', 'err');
            return;
        }
        setSync('syncing');
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
        if (error) { setSync('error'); setMsg('authmsg', error.message, 'err'); return; }
        setSync('connected');
        user = data.user;
        showApp();
        try { await load() } catch (e) { setMsg('authmsg', e.message, 'err'); }
    };

    // Email/password sign-up
    $('signup').onclick = async () => {
        if (!setupClient()) {
            setMsg('authmsg', 'Supabase publishable key is not configured. Open setup.html first.', 'err');
            return;
        }
        setSync('syncing');
        const { data, error } = await supabaseClient.auth.signUp({ email: $('email').value.trim(), password: $('password').value });
        if (error) { setSync('error'); setMsg('authmsg', error.message, 'err'); return; }
        setSync('connected');
        setMsg('authmsg', data.session ? 'Account created and signed in.' : 'Account created. Check your email to confirm it, then sign in.', 'ok');
    };

    // Window load handler
    window.addEventListener('load', async () => {
        reset();
        updateSetupLink();
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then(registration => registration.update()).catch(err => console.warn('Service worker registration failed:', err));
        }
        if (!setupClient()) {
            setMsg('authmsg', 'Supabase publishable key is missing or invalid. Open setup.html and enter the key from Supabase Project Settings → API.', 'err');
            return;
        }
        setSync('syncing');
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) { setSync('error'); setMsg('authmsg', error.message, 'err'); return; }
        setSync('connected');
        if (data.session) {
            user = data.session.user;
            showApp();
            try { await load() } catch (e) { setMsg('authmsg', e.message, 'err'); }
        }
    });
}

// Call bindFormHandlers and bindEventHandlers AFTER the inline script
// has defined globals (supabaseClient, user, meals, etc.) and after
// @supabase/supabase-js is loaded. We use window.addEventListener('load')
// defer, but since bindEventHandlers also sets up the load handler, we
// need to call bindFormHandlers() at the end of the inline script.
// bindEventHandlers() is called by the inline script.
