/*
 * ui/insights-view.js
 *
 * Weekly and Monthly insights view with trends.
 * Shows: total carbs, average glucose, weight average, water average.
 * Uses simple SVG bar/line charts — no external dependencies.
 *
 * Depends on globals from utils/ and services/ (loaded via <script> tags):
 *   - supabaseClient, user            (set up by index.html)
 *   - $, esc, fmt, localIso          (utils/html.js, utils/datetime.js)
 *   - dvFormatDate, dvParseDate      (utils/datetime.js)
 *
 * Depends on globals from index.html:
 *   - dvState                         (module-level state from dayview-renderer.js)
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let insightsState = {
    mode: 'week', // 'week' or 'month'
    weekOffset: 0, // 0 = current week, -1 = last week, etc.
    monthOffset: 0, // 0 = current month, -1 = last month, etc.
    data: null,
    loading: false,
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Sunday
    return d;
}

function getMonthStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    return d;
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/* ------------------------------------------------------------------ */
/* Data fetching                                                       */
/* ------------------------------------------------------------------ */

async function fetchInsightsData() {
    if (!supabaseClient || !user) return null;

    const now = new Date();
    let startDate, endDate;

    if (insightsState.mode === 'week') {
        const weekStart = getWeekStart(now);
        weekStart.setDate(weekStart.getDate() + insightsState.weekOffset * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        startDate = weekStart.toISOString();
        endDate = weekEnd.toISOString();
    } else {
        const monthStart = getMonthStart(now);
        monthStart.setMonth(monthStart.getMonth() + insightsState.monthOffset);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        startDate = monthStart.toISOString();
        endDate = monthEnd.toISOString();
    }

    try {
        const [mResult, gResult, wResult, wiResult] = await Promise.all([
            supabaseClient.from('meals').select('*').gte('meal_time', startDate).lte('meal_time', endDate).order('meal_time'),
            supabaseClient.from('glucose_readings').select('*').gte('measured_at', startDate).lte('measured_at', endDate).order('measured_at'),
            supabaseClient.from('weight_entries').select('*').gte('measured_at', startDate).lte('measured_at', endDate).order('measured_at'),
            supabaseClient.from('water_intake').select('*').gte('consumed_at', startDate).lte('consumed_at', endDate).order('consumed_at'),
        ]);

        if (mResult.error) throw mResult.error;
        if (gResult.error) throw gResult.error;
        if (wResult.error) throw wResult.error;
        if (wiResult.error) throw wiResult.error;

        const mealIds = (mResult.data || []).map(x => x.id);
        let mfResult = { data: [] };
        if (mealIds.length) {
            mfResult = await supabaseClient.from('meal_foods').select('*').in('meal_id', mealIds);
            if (mfResult.error) throw mfResult.error;
        }

        return {
            meals: mResult.data || [],
            glucose: gResult.data || [],
            weights: wResult.data || [],
            water: wiResult.data || [],
            mealFoods: mfResult.data || [],
        };
    } catch (err) {
        console.warn('[Insights] fetch failed:', err);
        return null;
    }
}

/* ------------------------------------------------------------------ */
/* Aggregation helpers                                                 */
/* ------------------------------------------------------------------ */

function aggregateByDay(data) {
    const days = {};
    const now = new Date();

    // Initialize all days in the range
    if (insightsState.mode === 'week') {
        const weekStart = getWeekStart(now);
        weekStart.setDate(weekStart.getDate() + insightsState.weekOffset * 7);
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            const key = dvFormatDate(d);
            days[key] = { date: key, carbs: 0, glucoseSum: 0, glucoseCount: 0, weightSum: 0, weightCount: 0, waterSum: 0, waterCount: 0 };
        }
    } else {
        const monthStart = getMonthStart(now);
        monthStart.setMonth(monthStart.getMonth() + insightsState.monthOffset);
        const year = monthStart.getFullYear();
        const month = monthStart.getMonth();
        const numDays = getDaysInMonth(year, month);
        for (let i = 1; i <= numDays; i++) {
            const d = new Date(year, month, i);
            const key = dvFormatDate(d);
            days[key] = { date: key, carbs: 0, glucoseSum: 0, glucoseCount: 0, weightSum: 0, weightCount: 0, waterSum: 0, waterCount: 0 };
        }
    }

    // Aggregate meals
    for (const meal of data.meals) {
        const key = dvFormatDate(new Date(meal.meal_time));
        if (days[key]) {
            days[key].carbs += Number(meal.estimated_carbohydrate_g) || 0;
        }
    }

    // Aggregate glucose
    for (const g of data.glucose) {
        const key = dvFormatDate(new Date(g.measured_at));
        if (days[key]) {
            days[key].glucoseSum += Number(g.glucose_mmol_l) || 0;
            days[key].glucoseCount++;
        }
    }

    // Aggregate weight
    for (const w of data.weights) {
        const key = dvFormatDate(new Date(w.measured_at));
        if (days[key]) {
            days[key].weightSum += Number(w.weight_kg) || 0;
            days[key].weightCount++;
        }
    }

    // Aggregate water
    for (const wi of data.water) {
        const key = dvFormatDate(new Date(wi.consumed_at));
        if (days[key]) {
            days[key].waterSum += Number(wi.amount_ml) || 0;
            days[key].waterCount++;
        }
    }

    return Object.values(days);
}

function aggregateByWeek(data) {
    const weeks = {};
    const now = new Date();
    const monthStart = getMonthStart(now);
    monthStart.setMonth(monthStart.getMonth() + insightsState.monthOffset);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const numDays = getDaysInMonth(year, month);

    // Initialize all weeks in the month
    const firstWeekStart = getWeekStart(new Date(year, month, 1));
    const lastWeekStart = getWeekStart(new Date(year, month, numDays));
    const weekKeys = [];
    for (let d = new Date(firstWeekStart); d <= lastWeekStart; d.setDate(d.getDate() + 7)) {
        const key = dvFormatDate(d);
        weekKeys.push(key);
        weeks[key] = { date: key, carbs: 0, glucoseSum: 0, glucoseCount: 0, weightSum: 0, weightCount: 0, waterSum: 0, waterCount: 0 };
    }

    // Aggregate meals
    for (const meal of data.meals) {
        const key = dvFormatDate(getWeekStart(new Date(meal.meal_time)));
        if (weeks[key]) {
            weeks[key].carbs += Number(meal.estimated_carbohydrate_g) || 0;
        }
    }

    // Aggregate glucose
    for (const g of data.glucose) {
        const key = dvFormatDate(getWeekStart(new Date(g.measured_at)));
        if (weeks[key]) {
            weeks[key].glucoseSum += Number(g.glucose_mmol_l) || 0;
            weeks[key].glucoseCount++;
        }
    }

    // Aggregate weight
    for (const w of data.weights) {
        const key = dvFormatDate(getWeekStart(new Date(w.measured_at)));
        if (weeks[key]) {
            weeks[key].weightSum += Number(w.weight_kg) || 0;
            weeks[key].weightCount++;
        }
    }

    // Aggregate water
    for (const wi of data.water) {
        const key = dvFormatDate(getWeekStart(new Date(wi.consumed_at)));
        if (weeks[key]) {
            weeks[key].waterSum += Number(wi.amount_ml) || 0;
            weeks[key].waterCount++;
        }
    }

    return Object.values(weeks);
}

/* ------------------------------------------------------------------ */
/* SVG chart builders                                                  */
/* ------------------------------------------------------------------ */

function buildBarChart(values, labels, color, unit, maxVal) {
    if (!values.length) return '<p class="muted">No data</p>';
    const w = 600, h = 120, pad = 24;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;
    const barW = Math.max(4, (chartW / values.length) - 4);
    const max = maxVal || Math.max(...values, 1);

    let bars = '';
    let xLabels = '';
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const barH = (v / max) * chartH;
        const x = pad + (i * (chartW / values.length)) + 2;
        const y = pad + chartH - barH;
        bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="2" opacity="0.8"><title>${labels[i]}: ${v.toFixed(1)} ${unit}</title></rect>`;
        if (values.length <= 7 || i % Math.ceil(values.length / 7) === 0) {
            xLabels += `<text x="${x + barW / 2}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--m)">${labels[i]}</text>`;
        }
    }

    // Y-axis line
    const axisY = pad + chartH;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">
        <line x1="${pad}" y1="${axisY}" x2="${w - pad}" y2="${axisY}" stroke="var(--b)" stroke-width="1"/>
        ${bars}${xLabels}
    </svg>`;
}

function buildLineChart(values, labels, color, unit, maxVal) {
    if (!values.length) return '<p class="muted">No data</p>';
    const w = 600, h = 120, pad = 24;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;
    const max = maxVal || Math.max(...values, 1);

    let points = '';
    let xLabels = '';
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const x = pad + (i / Math.max(1, values.length - 1)) * chartW;
        const y = pad + chartH - (v / max) * chartH;
        points += (i === 0 ? 'M' : 'L') + `${x},${y}`;
        if (values.length <= 7 || i % Math.ceil(values.length / 7) === 0) {
            xLabels += `<text x="${x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--m)">${labels[i]}</text>`;
        }
    }

    const axisY = pad + chartH;
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">
        <line x1="${pad}" y1="${axisY}" x2="${w - pad}" y2="${axisY}" stroke="var(--b)" stroke-width="1"/>
        <path d="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${xLabels}
    </svg>`;
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

function buildSummaryCards(days) {
    const totalCarbs = days.reduce((s, d) => s + d.carbs, 0);
    const avgGlucose = days.reduce((s, d) => s + d.glucoseSum, 0) / Math.max(1, days.reduce((s, d) => s + d.glucoseCount, 0));
    const avgWeight = days.reduce((s, d) => s + d.weightSum, 0) / Math.max(1, days.reduce((s, d) => s + d.weightCount, 0));
    const avgWater = days.reduce((s, d) => s + d.waterSum, 0) / Math.max(1, days.reduce((s, d) => s + d.waterCount, 0));
    const daysWithData = days.filter(d => d.carbs > 0 || d.glucoseCount > 0 || d.weightCount > 0 || d.waterCount > 0).length;

    return `<div class="metrics">
        <div class="metricbox"><div class="muted">Total Carbs</div><div class="metric">${totalCarbs.toFixed(0)}g</div><div class="muted">${daysWithData} days with data</div></div>
        <div class="metricbox"><div class="muted">Avg Glucose</div><div class="metric">${avgGlucose.toFixed(1)}</div><div class="muted">mmol/L</div></div>
        <div class="metricbox"><div class="muted">Avg Weight</div><div class="metric">${avgWeight.toFixed(1)}</div><div class="muted">kg</div></div>
        <div class="metricbox"><div class="muted">Avg Water</div><div class="metric">${avgWater.toFixed(0)}</div><div class="muted">ml/day</div></div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Main render                                                         */
/* ------------------------------------------------------------------ */

function renderInsights() {
    const container = $('insightsView');
    if (!container) return;

    const isWeek = insightsState.mode === 'week';
    const title = isWeek ? 'Weekly Insights' : 'Monthly Insights';
    const periodLabel = isWeek
        ? (insightsState.weekOffset === 0 ? 'This week' : insightsState.weekOffset === -1 ? 'Last week' : `${-insightsState.weekOffset} weeks ago`)
        : (insightsState.monthOffset === 0 ? 'This month' : insightsState.monthOffset === -1 ? 'Last month' : `${-insightsState.monthOffset} months ago`);

    const data = insightsState.data;
    if (!data) {
        container.innerHTML = '<div class="dv-empty">Loading...</div>';
        return;
    }

    const days = isWeek ? aggregateByDay(data) : aggregateByWeek(data);
    const labels = days.map(d => isWeek ? d.date.slice(5) : d.date.slice(5));
    const carbs = days.map(d => d.carbs);
    const glucose = days.map(d => d.glucoseCount > 0 ? d.glucoseSum / d.glucoseCount : 0);
    const weight = days.map(d => d.weightCount > 0 ? d.weightSum / d.weightCount : 0);
    const water = days.map(d => d.waterCount > 0 ? d.waterSum / d.waterCount : 0);

    container.innerHTML = `
        <div class="insights-header">
            <h2>📊 ${title}</h2>
            <div class="insights-controls">
                <button type="button" class="insights-nav" id="insightsPrev">←</button>
                <span class="muted">${periodLabel}</span>
                <button type="button" class="insights-nav" id="insightsNext">→</button>
            </div>
        </div>
        ${buildSummaryCards(days)}
        <div class="insights-charts">
            <div class="card">
                <h3>🍽️ Carbs (g)</h3>
                ${buildBarChart(carbs, labels, 'var(--dv-lane-food)', 'g')}
            </div>
            <div class="card">
                <h3>🩸 Glucose (mmol/L)</h3>
                ${buildLineChart(glucose, labels, 'var(--dv-lane-glucose)', 'mmol/L')}
            </div>
            <div class="card">
                <h3>⚖️ Weight (kg)</h3>
                ${buildLineChart(weight, labels, 'var(--dv-lane-weight)', 'kg')}
            </div>
            <div class="card">
                <h3>💧 Water (ml)</h3>
                ${buildBarChart(water, labels, 'var(--dv-lane-water)', 'ml')}
            </div>
        </div>
    `;
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function loadInsights() {
    insightsState.loading = true;
    const data = await fetchInsightsData();
    insightsState.data = data;
    insightsState.loading = false;
    renderInsights();
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

function insightsPrev() {
    if (insightsState.mode === 'week') insightsState.weekOffset--;
    else insightsState.monthOffset--;
    loadInsights();
}

function insightsNext() {
    if (insightsState.mode === 'week') insightsState.weekOffset++;
    else insightsState.monthOffset++;
    if (insightsState.weekOffset > 0) insightsState.weekOffset = 0;
    if (insightsState.monthOffset > 0) insightsState.monthOffset = 0;
    loadInsights();
}

/* ------------------------------------------------------------------ */
/* Event wiring                                                        */
/* ------------------------------------------------------------------ */

function installInsightsView() {
    const container = $('insightsView');
    if (!container) return;

    // Mode toggle
    const modeToggle = $('insightsModeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', () => {
            insightsState.mode = insightsState.mode === 'week' ? 'month' : 'week';
            modeToggle.textContent = insightsState.mode === 'week' ? '📅 Monthly' : '📅 Weekly';
            loadInsights();
        });
    }

    // Navigation
    const prevBtn = $('insightsPrev');
    const nextBtn = $('insightsNext');
    if (prevBtn) prevBtn.addEventListener('click', insightsPrev);
    if (nextBtn) nextBtn.addEventListener('click', insightsNext);

    // Initial load
    loadInsights();
}
