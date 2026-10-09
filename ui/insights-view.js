/*
 * ui/insights-view.js
 *
 * Weekly and Monthly insights view with trends.
 * Shows: total carbs, average glucose, weight average, water average.
 * Uses simple SVG charts with dots connected by lines — day view style.
 *
 * Depends on globals from utils/ and services/ (loaded via <script> tags):
 *   - supabaseClient, user            (set up by index.html)
 *   - $, esc, fmt, localIso          (utils/html.js, utils/datetime.js)
 *   - dvFormatDate, dvParseDate      (utils/datetime.js)
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let insightsState = {
    mode: 'week',
    weekOffset: 0,
    monthOffset: 0,
    data: null,
    loading: false,
};

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

function getLocalDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return dvFormatDate(d);
}

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
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

function syncInsightsModeToggle() {
    const toggle = $('insightsModeToggle');
    if (!toggle) return;
    toggle.textContent = insightsState.mode === 'week' ? '📅 Monthly' : '📅 Weekly';
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

    const weekStart = getWeekStart(now);
    weekStart.setDate(weekStart.getDate() + insightsState.weekOffset * 7);
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const key = getLocalDateKey(d);
        days[key] = { date: key, carbs: 0, glucoseSum: 0, glucoseCount: 0, weightSum: 0, weightCount: 0, waterSum: 0, waterCount: 0 };
    }

    for (const meal of data.meals || []) {
        const key = getLocalDateKey(meal.meal_time);
        if (days[key]) days[key].carbs += Number(meal.estimated_carbohydrate_g) || 0;
    }
    for (const g of data.glucose || []) {
        const key = getLocalDateKey(g.measured_at);
        if (days[key]) { days[key].glucoseSum += Number(g.glucose_mmol_l) || 0; days[key].glucoseCount++; }
    }
    for (const w of data.weights || []) {
        const key = getLocalDateKey(w.measured_at);
        if (days[key]) { days[key].weightSum += Number(w.weight_kg) || 0; days[key].weightCount++; }
    }
    for (const wi of data.water || []) {
        const key = getLocalDateKey(wi.consumed_at);
        if (days[key]) { days[key].waterSum += Number(wi.amount_ml) || 0; days[key].waterCount++; }
    }

    return Object.values(days);
}

function aggregateByMonth(data) {
    const monthStart = getMonthStart(new Date());
    monthStart.setMonth(monthStart.getMonth() + insightsState.monthOffset);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const totalDays = getDaysInMonth(year, month);
    const monthBuckets = {};

    for (let day = 1; day <= totalDays; day++) {
        const d = new Date(year, month, day);
        const key = getLocalDateKey(d);
        monthBuckets[key] = { date: key, carbs: 0, glucoseSum: 0, glucoseCount: 0, weightSum: 0, weightCount: 0, waterSum: 0, waterCount: 0 };
    }

    for (const meal of data.meals || []) {
        const key = getLocalDateKey(meal.meal_time);
        if (monthBuckets[key]) monthBuckets[key].carbs += Number(meal.estimated_carbohydrate_g) || 0;
    }
    for (const g of data.glucose || []) {
        const key = getLocalDateKey(g.measured_at);
        if (monthBuckets[key]) { monthBuckets[key].glucoseSum += Number(g.glucose_mmol_l) || 0; monthBuckets[key].glucoseCount++; }
    }
    for (const w of data.weights || []) {
        const key = getLocalDateKey(w.measured_at);
        if (monthBuckets[key]) { monthBuckets[key].weightSum += Number(w.weight_kg) || 0; monthBuckets[key].weightCount++; }
    }
    for (const wi of data.water || []) {
        const key = getLocalDateKey(wi.consumed_at);
        if (monthBuckets[key]) { monthBuckets[key].waterSum += Number(wi.amount_ml) || 0; monthBuckets[key].waterCount++; }
    }

    return Object.values(monthBuckets);
}

function aggregateByWeek(data) {
    return aggregateByMonth(data);
}

/* ------------------------------------------------------------------ */
/* Chart builders — matches Daily View style with emoji markers,        */
/* hover popups, dotted connecting lines, and Y-axis labels            */
/* ------------------------------------------------------------------ */

const CHART_ICONS = { carbs: '🍽️', glucose: '🩸', weight: '⚖️', water: '💧' };
const CHART_COLORS = { carbs: 'var(--dv-lane-food)', glucose: 'var(--dv-lane-glucose)', weight: 'var(--dv-lane-weight)', water: 'var(--dv-lane-water)' };

function buildTrendChart(values, labels, type, unit) {
    if (!values.length) return '<p class="muted">No data</p>';

    // Filter out null, undefined, empty, and zero values — only valid positive measurements
    const validPoints = [];
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v == null || v === '' || v === undefined) continue;
        const num = Number(v);
        if (!Number.isFinite(num) || num <= 0) continue;
        validPoints.push({ value: num, label: labels[i], originalIndex: i });
    }

    if (!validPoints.length) return '<p class="muted">No data</p>';

    const max = Math.max(...validPoints.map(p => p.value));
    const min = Math.min(...validPoints.map(p => p.value), 0);
    const range = max - min || 1;

    // Calculate positions as percentages (0-100) for DOM markers
    const points = validPoints.map((p, i) => ({
        x: (i / Math.max(1, validPoints.length - 1)) * 100,
        y: ((p.value - min) / range) * 100,
        value: p.value,
        label: p.label
    }));

    // Build Y-axis ticks (4 intervals = 5 labels)
    const yTicks = [];
    const numTicks = 4;
    for (let i = 0; i <= numTicks; i++) {
        const v = min + (range * i / numTicks);
        yTicks.push({ value: v, pct: (i / numTicks) * 100 });
    }

    // Build SVG dotted lines connecting consecutive valid points
    // Use a fixed viewBox (600x120) so line coordinates work in user units
    const svgW = 600, svgH = 120, pad = 10;
    const chartW = svgW - pad * 2;
    const chartH = svgH - pad * 2;
    const lines = [];
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const x1 = pad + (prev.x / 100) * chartW;
        const y1 = pad + chartH - (prev.y / 100) * chartH;
        const x2 = pad + (curr.x / 100) * chartW;
        const y2 = pad + chartH - (curr.y / 100) * chartH;
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${CHART_COLORS[type]}" stroke-width="2" opacity="0.5" stroke-dasharray="4 2"/>`);
    }
    const trendSvg = `<svg class="chart-trend" viewBox="0 0 ${svgW} ${svgH}" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1">${lines.join('')}</svg>`;

    // Build emoji markers with hover popups (day view style)
    const markers = points.map(p => `
        <div class="chart-event" data-type="${type}" style="left:${p.x}%;bottom:${p.y}%"
             title="${esc(p.label)}: ${p.value.toFixed(1)} ${unit}">
            ${CHART_ICONS[type]}
            <div class="chart-popup">${esc(p.label)}: ${p.value.toFixed(1)} ${unit}</div>
        </div>
    `).join('');

    // Build Y-axis labels
    const yAxisLabels = yTicks.map(t =>
        `<span style="bottom:${t.pct}%">${t.value.toFixed(0)}</span>`
    ).join('');

    // Build X-axis labels (show all if <= 7, otherwise sample)
    const xAxisLabels = labels.map((l, i) => {
        if (labels.length <= 7 || i % Math.ceil(labels.length / 7) === 0) {
            return `<span style="left:${(i / Math.max(1, labels.length - 1)) * 100}%">${esc(l)}</span>`;
        }
        return '';
    }).join('');

    return `
        <div class="chart-container">
            <div class="chart-yaxis">
                ${yAxisLabels}
                <span class="chart-yaxis-label" style="right: 1px;">${unit}</span>
            </div>
            <div class="chart-plot">
                ${trendSvg}
                ${markers}
            </div>
            <div class="chart-xaxis">${xAxisLabels}</div>
        </div>
    `;
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

    syncInsightsModeToggle();

    const data = insightsState.data;
    if (!data) {
        container.innerHTML = '<div class="dv-empty">No data available. Make sure you are signed in and have recorded data.</div>';
        return;
    }

    const days = isWeek ? aggregateByDay(data) : aggregateByMonth(data);
    const labels = days.map(d => d.date.slice(5));
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
                ${buildTrendChart(carbs, labels, 'carbs', 'g')}
            </div>
            <div class="card">
                <h3>🩸 Glucose (mmol/L)</h3>
                ${buildTrendChart(glucose, labels, 'glucose', 'mmol/L')}
            </div>
            <div class="card">
                <h3>⚖️ Weight (kg)</h3>
                ${buildTrendChart(weight, labels, 'weight', 'kg')}
            </div>
            <div class="card">
                <h3>💧 Water (ml)</h3>
                ${buildTrendChart(water, labels, 'water', 'ml')}
            </div>
        </div>
    `;
}

/* ------------------------------------------------------------------ */
/* Data loading with retry                                             */
/* ------------------------------------------------------------------ */

async function loadInsights() {
    insightsState.loading = true;
    renderInsights();

    // Wait for supabaseClient and user to be available
    let attempts = 0;
    while ((!supabaseClient || !user) && attempts < 30) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }

    if (!supabaseClient || !user) {
        insightsState.loading = false;
        renderInsights();
        return;
    }

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

    // Use event delegation so navigation works even after re-renders
    container.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'insightsPrev') {
            insightsPrev();
        } else if (target.id === 'insightsNext') {
            insightsNext();
        } else if (target.id === 'insightsModeToggle') {
            insightsState.mode = insightsState.mode === 'week' ? 'month' : 'week';
            syncInsightsModeToggle();
            loadInsights();
        }
    });

    syncInsightsModeToggle();
    loadInsights();
}
