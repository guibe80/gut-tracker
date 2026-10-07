/*
 * ui/render.js
 *
 * Main view rendering: list entries, counts, glucose summary,
 * timeline events, and pagination controls.
 *
 * Depends on globals from utils/ and services/ (loaded via <script> tags):
 *   - $, esc, fmt, localIso              (utils/html.js, utils/datetime.js)
 *   - mealOptions()                      (defined in index.html inline script)
 *
 * Depends on globals from index.html:
 *   - meals, glucose, symptoms,          (data arrays)
 *     bowels, weights, mealFoods
 *   - totals                             (count state)
 *   - user                               (auth state)
 *   - pageSize, page                     (pagination state)
 *   - timelinePageSize, timelinePage     (timeline pagination)
 *   - dvRender()                         (day-view renderer, ui/dayview-renderer.js)

 * The render() function is the main coordinator — it updates all list
 * views, the glucose summary, and the timeline, then calls dvRender()
 * to refresh the day-view panel.
 *
 * buildTimelineEvents() is a pure function extracted from render() for
 * unit testability — it transforms raw data arrays into timeline event
 * objects with filtering and sorting.
 */

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Build a flat, filtered, sorted list of timeline events from all data
 * arrays. This is the pure logic extracted from render() so it can be
 * unit-tested independently of the DOM.
 *
 * @param {object} data - { meals, glucose, symptoms, bowels, weights, mealFoods }
 * @param {string} filter - timeline filter type ('all' or a specific type)
 * @returns {Array<{type, t, label, detail}>} sorted newest-first
 */
function buildTimelineEvents(data, filter) {
    return [...data.meals.map(x => ({ type: 'food', t: x.meal_time, label: '🍽️ ' + (x.meal_type || 'Meal').replace(/^./, character => character.toUpperCase()), detail: data.mealFoods.filter(f => f.meal_id === x.id).map(f => f.food_name).filter(Boolean).join(', ') })), ...data.glucose.map(x => ({ type: 'glucose', t: x.measured_at, label: '🩸 ' + x.glucose_mmol_l + ' mmol/L', detail: x.timing || '' })), ...data.symptoms.map(x => ({ type: 'gut', t: x.occurred_at, label: '🫃 ' + (x.symptom_type || 'Symptom'), detail: (x.severity ?? 0) + '/10' })), ...data.bowels.map(x => ({ type: 'bowel', t: x.occurred_at, label: '🚽 Bristol ' + x.bristol_type, detail: '' })), ...data.weights.map(x => ({ type: 'weight', t: x.measured_at, label: '⚖️ ' + Number(x.weight_kg).toFixed(2) + ' kg', detail: x.notes || '' }))].filter(event => filter === 'all' || event.type === filter).sort((a, b) => new Date(b.t) - new Date(a.t));
}

/**
 * Build the per-table list HTML for a single entry.
 * Extracted for testability — pure string transformation.
 */
function entryHtml(table, x, mealFoods) {
    const editMap = { meals: 'food', glucose_readings: 'glucose', gut_symptoms: 'gut', bowel_movements: 'bowel', weight_entries: 'weight' };
    const t = editMap[table];
    switch (table) {
        case 'meals': {
            const foods = mealFoods.filter(f => f.meal_id === x.id).map(f => f.food_name).filter(Boolean).join(', ');
            const mealType = (x.meal_type || '').replace(/^./, character => character.toUpperCase());
            return `<div class="entry"><strong>${esc(fmt(x.meal_time))}</strong> · ${esc(mealType)}<div>${esc(foods || x.notes || '')}</div><div class="entry-actions"><button type="button" class="entry-edit" data-edit-table="meals" data-edit-id="${esc(x.id)}">Edit</button><button type="button" class="entry-delete" data-delete-table="meals" data-delete-id="${esc(x.id)}">Delete</button></div></div>`;
        }
        case 'glucose_readings':
            return `<div class="entry"><strong>${esc(fmt(x.measured_at))}</strong> · ${esc(x.glucose_mmol_l)} mmol/L · ${esc(x.timing || '')}<div class="entry-actions"><button type="button" class="entry-edit" data-edit-table="glucose_readings" data-edit-id="${esc(x.id)}">Edit</button><button type="button" class="entry-delete" data-delete-table="glucose_readings" data-delete-id="${esc(x.id)}">Delete</button></div></div>`;
        case 'gut_symptoms':
            return `<div class="entry"><strong>${esc(fmt(x.occurred_at))}</strong> · ${esc(x.symptom_type || '')} · ${esc(x.severity ?? 0)}/10<div class="entry-actions"><button type="button" class="entry-edit" data-edit-table="gut_symptoms" data-edit-id="${esc(x.id)}">Edit</button><button type="button" class="entry-delete" data-delete-table="gut_symptoms" data-delete-id="${esc(x.id)}">Delete</button></div></div>`;
        case 'bowel_movements':
            return `<div class="entry"><strong>${esc(fmt(x.occurred_at))}</strong> · Bristol ${esc(x.bristol_type)}<div class="entry-actions"><button type="button" class="entry-edit" data-edit-table="bowel_movements" data-edit-id="${esc(x.id)}">Edit</button><button type="button" class="entry-delete" data-delete-table="bowel_movements" data-delete-id="${esc(x.id)}">Delete</button></div></div>`;
        case 'weight_entries':
            return `<div class="entry"><strong>${esc(fmt(x.measured_at))}</strong> · ${esc(Number(x.weight_kg).toFixed(2))} kg${x.notes ? `<div>${esc(x.notes)}</div>` : ''}<div class="entry-actions"><button type="button" class="entry-edit" data-edit-table="weight_entries" data-edit-id="${esc(x.id)}">Edit</button><button type="button" class="entry-delete" data-delete-table="weight_entries" data-delete-id="${esc(x.id)}">Delete</button></div></div>`;
        default:
            return '';
    }
}

/* ------------------------------------------------------------------ */
/* Main render                                                          */
/* ------------------------------------------------------------------ */

function render() {
    $('mc').textContent = totals.meals;
    $('gc').textContent = totals.glucose;
    $('xc').textContent = totals.symptoms;
    $('bcnt').textContent = totals.bowels;
    $('wcnt').textContent = totals.weights;
    $('userInfo').textContent = user?.email || user?.user_metadata?.user_name || '';
    mealOptions();

    const data = { meals, glucose, symptoms, bowels, weights, mealFoods };

    $('flist').innerHTML = meals.map(x => entryHtml('meals', x, mealFoods)).join('') || '<p class="muted">No meals yet.</p>';
    $('glist').innerHTML = glucose.map(x => entryHtml('glucose_readings', x, mealFoods)).join('') || '<p class="muted">No readings yet.</p>';
    $('slist').innerHTML = symptoms.map(x => entryHtml('gut_symptoms', x, mealFoods)).join('') || '<p class="muted">No symptoms yet.</p>';
    $('blist').innerHTML = bowels.map(x => entryHtml('bowel_movements', x, mealFoods)).join('') || '<p class="muted">No bowel movements yet.</p>';
    $('wlist').innerHTML = weights.map(x => entryHtml('weight_entries', x, mealFoods)).join('') || '<p class="muted">No weigh-ins yet.</p>';

    updatePagers();

    const vals = glucose.map(x => Number(x.glucose_mmol_l)).filter(Number.isFinite);
    $('gsummary').textContent = vals.length ? `Average recorded glucose: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)} mmol/L · Latest: ${vals[0].toFixed(1)} mmol/L` : 'Add spot readings to see your recent pattern.';

    const timelineFilter = $('timelineFilter')?.value || 'all';
    const events = buildTimelineEvents(data, timelineFilter);
    const timelinePages = Math.max(1, Math.ceil(events.length / timelinePageSize));
    timelinePage = Math.min(timelinePage, timelinePages - 1);
    const timelineStart = timelinePage * timelinePageSize;
    $('timelineList').innerHTML = events.slice(timelineStart, timelineStart + timelinePageSize).map(e => `<div class="entry"><strong>${esc(fmt(e.t))}</strong> · ${esc(e.label)}${e.detail ? ' · ' + esc(e.detail) : ''}</div>`).join('') || '<p class="muted">No records for this filter.</p>';
    $('timelinePageLabel').textContent = ` ${timelinePage + 1} / ${timelinePages} `;
    $('timelinePrev').disabled = timelinePage === 0;
    $('timelineNext').disabled = timelinePage >= timelinePages - 1;

    dvRender();
    renderWaterIntake?.();
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

function updatePagers() {
    for (const name of Object.keys(pageSize)) {
        const totalPages = Math.max(1, Math.ceil(totals[name] / pageSize[name]));
        const label = document.querySelector(`[data-page-label="${name}"]`);
        const previous = document.querySelector(`[data-page-prev="${name}"]`);
        const next = document.querySelector(`[data-page-next="${name}"]`);
        if (label) label.textContent = ` ${page[name] + 1} / ${totalPages} `;
        if (previous) previous.disabled = page[name] === 0;
        if (next) next.disabled = page[name] >= totalPages - 1;
    }
}
