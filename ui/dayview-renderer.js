/*
 * ui/dayview-renderer.js
 *
 * Day-view timeline renderer: fetches per-day data from Supabase,
 * transforms records into timeline events, and builds the DOM.
 *
 * Depends on globals from utils/ and services/ (loaded via <script> tags):
 *   - supabaseClient, user            (set up by index.html)
 *   - $, dvDayStart, dvDayEnd,        (utils/datetime.js)
 *     dvFormatDate, dvParseDate,     (utils/datetime.js)
 *     dvPercentThrough, dvFormatHour, (utils/datetime.js)
 *     parseTzNotes, esc, fmt         (utils/datetime.js + utils/html.js)
 *
 * Depends on services/data-service.js:
 *   - load()                           (used indirectly via render after edits)
 *
 * Depends on globals from index.html:
 *   - DV_REDIRECT                      (constant, defined inline)
 *   - dvState, DV_LANE_ORDER,          (module-level state)
 *     DV_LANE_LABEL, DV_LANE_ICON
 *
 * The dv* functions access shared globals ($ for DOM queries, supabaseClient,
 * user, dvState) via the shared script scope — same pattern as utils/.
 */

/* ------------------------------------------------------------------ */
/* State & constants                                                    */
/* ------------------------------------------------------------------ */

let dvState = { date: new Date().toISOString().slice(0, 10), toggles: { food: true, glucose: true, gut: true, bowel: true, weight: true, water: true }, data: null, loading: false };

const DV_LANE_ORDER = ['food', 'glucose', 'gut', 'bowel', 'weight', 'water'];
const DV_LANE_LABEL = { food: 'Food', glucose: 'Glucose', gut: 'Gut', bowel: 'Bowel', weight: 'Weight', water: 'Water' };
const DV_LANE_ICON = { food: '🍽️', glucose: '🩸', gut: '🫃', bowel: '🚽', weight: '⚖️', water: '💧' };

/* ------------------------------------------------------------------ */
/* Data fetching                                                        */
/* ------------------------------------------------------------------ */

async function dvFetch(isoDate) {
    if (dvState.data && dvState.date === isoDate) return dvState.data;
    const dayStart = dvDayStart(isoDate).toISOString();
    const dayEnd = dvDayEnd(isoDate).toISOString();
    if (!supabaseClient || !user) return null;
    try {
        const [mResult, gResult, sResult, bResult, wResult, wiResult] = await Promise.all([
            supabaseClient.from('meals').select('*').gte('meal_time', dayStart).lte('meal_time', dayEnd).order('meal_time'),
            supabaseClient.from('glucose_readings').select('*').gte('measured_at', dayStart).lte('measured_at', dayEnd).order('measured_at'),
            supabaseClient.from('gut_symptoms').select('*').gte('occurred_at', dayStart).lte('occurred_at', dayEnd).order('occurred_at'),
            supabaseClient.from('bowel_movements').select('*').gte('occurred_at', dayStart).lte('occurred_at', dayEnd).order('occurred_at'),
            supabaseClient.from('weight_entries').select('*').gte('measured_at', dayStart).lte('measured_at', dayEnd).order('measured_at'),
            supabaseClient.from('water_intake').select('*').gte('consumed_at', dayStart).lte('consumed_at', dayEnd).order('consumed_at')
        ]);
        if (mResult.error) throw mResult.error;
        if (gResult.error) throw gResult.error;
        if (sResult.error) throw sResult.error;
        if (bResult.error) throw bResult.error;
        if (wResult.error) throw wResult.error;
        if (wiResult.error) throw wiResult.error;
        const mealIds = (mResult.data || []).map(x => x.id);
        let mfResult = { data: [] };
        if (mealIds.length) { mfResult = await supabaseClient.from('meal_foods').select('*').in('meal_id', mealIds); if (mfResult.error) throw mfResult.error; }
        dvState.data = { meals: mResult.data || [], glucose: gResult.data || [], symptoms: sResult.data || [], bowels: bResult.data || [], weights: wResult.data || [], waterIntake: wiResult.data || [], mealFoods: mfResult.data || [] };
        dvState.date = isoDate;
        return dvState.data;
    } catch (err) {
        console.warn('Day view fetch failed for', isoDate, err);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Event transformation (pure data mapping)                           */
/* ------------------------------------------------------------------ */

function dvGetEvents(data, type) {
    if (!data) return [];
    const dayStart = dvDayStart(dvState.date).getTime();
    const dayEnd = dvDayEnd(dvState.date).getTime();
    const filter = e => { const t = new Date(e.t).getTime(); return t >= dayStart && t <= dayEnd; };
    switch (type) {
        case 'food': return data.meals.map(x => ({ type: 'food', t: x.meal_time, tz: parseTzNotes(x.notes), detail: data.mealFoods.filter(f => f.meal_id === x.id).map(f => f.food_name).filter(Boolean).join(', '), value: x.estimated_carbohydrate_g || 0 })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        case 'glucose': return data.glucose.map(x => ({ type: 'glucose', t: x.measured_at, tz: parseTzNotes(x.notes), detail: x.glucose_mmol_l + ' mmol/L', value: x.glucose_mmol_l })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        case 'gut': return data.symptoms.map(x => ({ type: 'gut', t: x.occurred_at, tz: parseTzNotes(x.notes), detail: (x.symptom_type || 'Symptom') + ' · ' + (x.severity ?? 0) + '/10' })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        case 'bowel': return data.bowels.map(x => ({ type: 'bowel', t: x.occurred_at, tz: parseTzNotes(x.notes), detail: 'Bristol ' + x.bristol_type })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        case 'weight': return data.weights.map(x => ({ type: 'weight', t: x.measured_at, tz: parseTzNotes(x.notes), detail: Number(x.weight_kg).toFixed(2) + ' kg', value: x.weight_kg })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        case 'water': return (data.waterIntake || []).map(x => ({ type: 'water', t: x.consumed_at, tz: parseTzNotes(x.notes), detail: Number(x.amount_ml) + ' ml', value: x.amount_ml })).filter(filter).sort((a, b) => new Date(a.t) - new Date(b.t));
        default: return [];
    }
}

/* ------------------------------------------------------------------ */
/* DOM building                                                       */
/* ------------------------------------------------------------------ */

function dvBuild() {
    const elTimeline = $('dvTimeline');
    const elToggles = $('dvToggles');
    const elTimeAxis = $('dvTimeAxis');
    const elLanes = $('dvLanes');
    if (!elTimeline || !elToggles || !elTimeAxis || !elLanes) return;

    const dayStart = dvDayStart(dvState.date);
    const now = new Date();
    const showNowLine = dvState.date === dvFormatDate(now);

    elToggles.innerHTML = DV_LANE_ORDER.map(type => `<button type="button" class="dv-toggle ${dvState.toggles[type] ? 'active' : ''}" data-dv-type="${type}">${DV_LANE_ICON[type]} ${DV_LANE_LABEL[type]}</button>`).join('');

    elTimeAxis.innerHTML = ['00:00','03:00','06:00','09:00','12:00','15:00','18:00','21:00','24:00'].map((label, i) => {
        const pct = i * 12.5;
        const transform = i === 0 ? 'translateX(0)' : i === 8 ? 'translateX(-100%)' : 'translateX(-50%)';
        return `<span style="position:absolute;left:${pct}%;transform:${transform}">${label}</span>`;
    }).join('');

    const visibleTypes = DV_LANE_ORDER.filter(type => dvState.toggles[type]);
    const data = dvState.data;
    let html = '';
    let eventCount = 0;

    const YAXIS_RANGES = { glucose: { min: 4, max: 15, label: 'mmol/L' }, weight: { auto: true, label: 'kg' }, food: { auto: true, label: 'g carbs' }, water: { maxOnly: true, label: 'ml' } };

    for (const type of visibleTypes) {
        const events = dvGetEvents(data, type);
        if (events.length === 0) continue;
        eventCount += events.length;

        const yaxis = YAXIS_RANGES[type];
        let laneClass = 'dv-lane';
        let yaxisHtml = '';
        let trendHtml = '';
        let yMin, yMax;

        if (yaxis) {
            laneClass += ' has-yaxis';
            if (type === 'glucose') {
                yMin = yaxis.min; yMax = yaxis.max;
            } else if (yaxis.maxOnly && events.length > 0) {
                const vals = events.map(e => e.value).filter(v => typeof v === 'number' && Number.isFinite(v));
                if (vals.length) { yMin = 0; yMax = Math.max(...vals); }
            } else if (yaxis.auto && events.length > 0) {
                const vals = events.map(e => e.value).filter(v => typeof v === 'number' && Number.isFinite(v));
                if (vals.length) { yMin = type === 'food' ? 0 : Math.min(...vals) - 2; yMax = Math.max(...vals) + 2; }
            }
            if (yMin !== undefined && yMax !== undefined && yMax > yMin) {
                const range = yMax - yMin;
                const ticks = yaxis.maxOnly ? [yMin, yMax] : (() => {
                    const step = type === 'food' ? (range <= 50 ? 5 : 10) : (range <= 6 ? 1 : range <= 20 ? 2 : 5);
                    const t = [];
                    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) t.push(v);
                    return t;
                })();
                yaxisHtml = `<div class="dv-yaxis">${ticks.map(v => { const pct = ((v - yMin) / (yMax - yMin)) * 100; return `<span style="bottom:${pct}%">${Number.isInteger(v) ? v : v.toFixed(1)}</span>`; }).join('')}</div><span class="dv-yaxis-label">${yaxis.label || ''}</span>`;
                if (events.length > 1) {
                    const lines = [];
                    for (let i = 1; i < events.length; i++) {
                        const prev = events[i - 1];
                        const curr = events[i];
                        const prevPct = dvPercentThrough(dayStart, prev.t);
                        const currPct = dvPercentThrough(dayStart, curr.t);
                        const prevV = ((prev.value - yMin) / (yMax - yMin)) * 100;
                        const currV = ((curr.value - yMin) / (yMax - yMin)) * 100;
                        lines.push(`<line x1="${prevPct * 100}%" y1="${100 - prevV}%" x2="${currPct * 100}%" y2="${100 - currV}%" stroke="var(--dv-lane-${type})" stroke-width="2" opacity="0.35" stroke-dasharray="4 2"/>`);
                    }
                    trendHtml = `<svg class="dv-trend" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1">${lines.join('')}</svg>`;
                }
            }
        }

        const infoBadge = type === 'food' && events.length ? `<div class="dv-info" style="background:var(--dv-lane-food)">${events.reduce((s,e) => s + (e.value || 0), 0).toFixed(0)}g carbs</div>` : type === 'glucose' && events.length ? `<div class="dv-info" style="background:var(--dv-lane-glucose)">avg ${(events.reduce((s,e) => s + e.value, 0) / events.length).toFixed(1)}</div>` : type === 'water' && events.length ? `<div class="dv-info" style="background:var(--dv-lane-water)">${events.reduce((s,e) => s + e.value, 0).toFixed(0)} ml</div>` : '';
        html += `<div class="${laneClass}" data-dv-lane="${type}" style="margin-top: ${type === visibleTypes[0] ? 0 : 8}px}">${trendHtml}${yaxisHtml}<span class="dv-lane-label">${DV_LANE_ICON[type]} ${DV_LANE_LABEL[type]}</span>${infoBadge}`;
        for (const e of events) {
            const pct = dvPercentThrough(dayStart, e.t);
            const leftPct = pct * 100;
            const timeStr = dvFormatHour(pct);
            let eventStyle = `left:${leftPct}%`;
            if (yaxis && e.value !== undefined && Number.isFinite(e.value) && yMax > yMin) {
                const vPct = ((e.value - yMin) / (yMax - yMin)) * 100;
                eventStyle += `;bottom:${vPct}%`;
            }
            html += `<div class="dv-event${yaxis ? ' has-yaxis' : ''}" data-dv-type="${type}" data-dv-time="${esc(timeStr)}" data-dv-detail="${esc(e.detail || '')}" style="${eventStyle}" title="${esc(timeStr)}${e.detail ? ' · ' + esc(e.detail) : ''}">${DV_LANE_ICON[type]}<div class="dv-event-popup">${esc(timeStr)}${e.detail ? ' · ' + esc(e.detail) : ''}</div></div>`;
        }
        html += '</div>';
    }

    if (showNowLine && visibleTypes.length && dvState.toggles[visibleTypes[0]] && eventCount > 0) {
        const nowMs = now.getTime();
        const nowPct = dvPercentThrough(dayStart, nowMs);
        if (nowPct >= 0 && nowPct <= 1) {
            html += `<div class="dv-now" style="left:${nowPct * 100}%"></div>`;
        }
    }

    if (eventCount === 0) {
        html += `<div class="dv-empty">Nothing recorded on ${dvState.date}.</div>`;
    }

    elLanes.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/* Render orchestration                                                */
/* ------------------------------------------------------------------ */

async function dvRender() {
    const requestedDate = dvState.date;
    try {
        const elLanes = $('dvLanes');
        if (elLanes) elLanes.innerHTML = '<div class="dv-empty">Loading...</div>';
        const data = await dvFetch(dvState.date);
        // Discard if a newer navigation moved us off this date
        if (requestedDate !== dvState.date) return;
        if (!data) {
            const elLanes2 = $('dvLanes');
            if (elLanes2) elLanes2.innerHTML = '<div class="dv-empty">Not signed in.</div>';
            return;
        }
        dvBuild();
    } catch (err) {
        console.error('Day view render error:', err);
        const elLanes3 = $('dvLanes');
        if (elLanes3) elLanes3.innerHTML = '<div class="dv-empty">Error loading data.</div>';
    }
}

/* ------------------------------------------------------------------ */
/* Navigation                                                         */
/* ------------------------------------------------------------------ */

function dvGoTo(dateIso) {
    dvState.date = dateIso;
    dvState.data = null;
    if ($('dvDate')) $('dvDate').value = dateIso;
    dvRender();
}

function dvToggle(type) {
    dvState.toggles[type] = !dvState.toggles[type];
}

function dvToday() { dvGoTo(dvFormatDate(new Date())); }

function dvPrev() {
    const d = new Date(dvParseDate(dvState.date).getTime());
    d.setDate(d.getDate() - 1);
    dvGoTo(dvFormatDate(d));
}

function dvNext() {
    const d = new Date(dvParseDate(dvState.date).getTime());
    d.setDate(d.getDate() + 1);
    dvGoTo(dvFormatDate(d));
}

/* ------------------------------------------------------------------ */
/* Event wiring (must run after DOM is ready)                         */
/* ------------------------------------------------------------------ */

function dvInit() {
    $('dvPrevDay').addEventListener('click', dvPrev);
    $('dvNextDay').addEventListener('click', dvNext);
    $('dvToday').addEventListener('click', dvToday);
    $('dvDate').addEventListener('change', () => { const val = $('dvDate').value; if (val) dvGoTo(val); });
    $('dvToggles').addEventListener('click', event => { const btn = event.target.closest('.dv-toggle'); if (!btn) return; dvToggle(btn.dataset.dvType); dvBuild(); });
}
