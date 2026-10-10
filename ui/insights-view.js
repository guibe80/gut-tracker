/*
 * ui/insights-view.js
 *
 * Weekly and Monthly insights view with trends.
 * Shows: total carbs, average glucose, weight average, water average.
 * Uses Chart.js line charts with emoji markers.
 *
 * Depends on globals from utils/ and services/ (loaded via <script> tags):
 *   - supabaseClient, user            (set up by index.html)
 *   - $, esc, fmt, localIso          (utils/html.js, utils/datetime.js)
 *   - dvFormatDate, dvParseDate      (utils/datetime.js)
 *   - Chart                           (Chart.js CDN)
 *   - createChartConfig, createEmojiChart, destroyChart  (js/chartjs-config.js)
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

var insightsState = {
    mode: 'week',
    weekOffset: 0,
    monthOffset: 0,
    data: null,
    loading: false,
};

const safeEsc = typeof esc === 'function'
    ? esc
    : function(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function formatInsightAxisLabel(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    return `${day}-${month}`;
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
    const monthBuckets = [];

    for (let weekIndex = 0; weekIndex < Math.ceil(totalDays / 7); weekIndex++) {
        const startDay = weekIndex * 7 + 1;
        const endDay = Math.min(totalDays, startDay + 6);
        const startDate = new Date(year, month, startDay, 0, 0, 0);
        const endDate = new Date(year, month, endDay, 0, 0, 0);
        monthBuckets.push({
            date: getLocalDateKey(startDate),
            label: `W${weekIndex + 1}`,
            totalCarbs: 0,
            daysInBucket: endDay - startDay + 1,
            glucoseSum: 0,
            glucoseCount: 0,
            weightSum: 0,
            weightCount: 0,
            waterSum: 0,
            waterCount: 0,
        });
    }

    const bucketIndexForDate = (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const dayOfMonth = date.getDate();
        return Math.floor((dayOfMonth - 1) / 7);
    };

    for (const meal of data.meals || []) {
        const bucketIndex = bucketIndexForDate(meal.meal_time);
        if (bucketIndex == null || !monthBuckets[bucketIndex]) continue;
        monthBuckets[bucketIndex].totalCarbs += Number(meal.estimated_carbohydrate_g) || 0;
    }
    for (const g of data.glucose || []) {
        const bucketIndex = bucketIndexForDate(g.measured_at);
        if (bucketIndex == null || !monthBuckets[bucketIndex]) continue;
        monthBuckets[bucketIndex].glucoseSum += Number(g.glucose_mmol_l) || 0;
        monthBuckets[bucketIndex].glucoseCount++;
    }
    for (const w of data.weights || []) {
        const bucketIndex = bucketIndexForDate(w.measured_at);
        if (bucketIndex == null || !monthBuckets[bucketIndex]) continue;
        monthBuckets[bucketIndex].weightSum += Number(w.weight_kg) || 0;
        monthBuckets[bucketIndex].weightCount++;
    }
    for (const wi of data.water || []) {
        const bucketIndex = bucketIndexForDate(wi.consumed_at);
        if (bucketIndex == null || !monthBuckets[bucketIndex]) continue;
        monthBuckets[bucketIndex].waterSum += Number(wi.amount_ml) || 0;
        monthBuckets[bucketIndex].waterCount++;
    }

    return monthBuckets.map(bucket => ({
        date: bucket.date,
        label: bucket.label,
        carbs: bucket.daysInBucket ? bucket.totalCarbs / bucket.daysInBucket : 0,
        glucoseSum: bucket.glucoseSum,
        glucoseCount: bucket.glucoseCount,
        weightSum: bucket.weightSum,
        weightCount: bucket.weightCount,
        waterSum: bucket.waterSum,
        waterCount: bucket.waterCount,
    }));
}

function aggregateByWeek(data) {
    return aggregateByMonth(data);
}

/* ------------------------------------------------------------------ */
/* Chart builders — Chart.js line charts with emoji markers,            */
/* hover tooltips, dotted connecting lines, and axis labels           */
/* ------------------------------------------------------------------ */
const CHART_ICONS = { carbs: '🍽️', glucose: '🩸', weight: '⚖️', water: '💧' };
const CHART_COLORS = { carbs: 'var(--dv-lane-food)', glucose: 'var(--dv-lane-glucose)', weight: 'var(--dv-lane-weight)', water: 'var(--dv-lane-water)' };

/* ------------------------------------------------------------------ */
/* Chart instance storage for lifecycle management                     */
/* ------------------------------------------------------------------ */

var insightsCharts = {};
var insightsChartConfigs = {};

function destroyInsightsCharts() {
    Object.keys(insightsCharts).forEach(function(key) {
        if (typeof destroyChart === 'function') {
            destroyChart(insightsCharts[key]);
        } else if (insightsCharts[key] && typeof insightsCharts[key].destroy === 'function') {
            insightsCharts[key].destroy();
        }
        delete insightsCharts[key];
    });
    insightsChartConfigs = {};
}

function initInsightsCharts() {
    if (typeof createChartConfig !== 'function' || typeof createEmojiChart !== 'function') return;

    Object.keys(insightsChartConfigs).forEach(function(canvasId) {
        var config = insightsChartConfigs[canvasId];
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        var chartConfig = createChartConfig({
            data: {
                labels: config.labels,
                datasets: [{
                    label: '',
                    data: config.values,
                    emoji: config.emoji,
                    borderColor: config.color,
                    backgroundColor: config.color,
                }]
            },
            yTitle: config.unit,
            getLabel: function(tooltip) {
                if (!tooltip.dataPoints || !tooltip.dataPoints.length) return '';
                var idx = tooltip.dataPoints[0].dataIndex;
                return safeEsc(config.labels[idx] || '');
            },
            getDetail: function(tooltip) {
                if (!tooltip.dataPoints || !tooltip.dataPoints.length) return '';
                var idx = tooltip.dataPoints[0].dataIndex;
                var val = config.values[idx];
                if (val == null) return '';
                return Number(val).toFixed(1) + ' ' + config.unit;
            },
        });

        var chart = createEmojiChart(canvas, chartConfig);
        if (chart) {
            insightsCharts[canvasId] = chart;
        }
    });
}

function buildTrendChart(values, labels, type, unit, explicitDates) {
    // Keep all labels for consistent X-axis alignment across charts.
    // Replace null/undefined/empty/zero with null (Chart.js renders as gap).
    var chartValues = [];
    for (var i = 0; i < values.length; i++) {
        var v = values[i];
        if (v == null || v === '' || v === undefined) {
            chartValues.push(null);
            continue;
        }
        var num = Number(v);
        if (!Number.isFinite(num) || num <= 0) {
            chartValues.push(null);
            continue;
        }
        chartValues.push(num);
    }

    // Check if there's any valid data at all
    var hasValidData = chartValues.some(function(v) { return v !== null; });
    if (!hasValidData) return '<p class="muted">No data</p>';

    // Generate a unique canvas ID for this chart instance
    var canvasId = 'insightsChart-' + type + '-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

    // Store config for deferred chart creation (after DOM insertion)
    insightsChartConfigs[canvasId] = {
        labels: labels,
        values: chartValues,
        emoji: CHART_ICONS[type] || '●',
        color: CHART_COLORS[type] || '#999',
        unit: unit,
    };

    return '<div class="chart-container">' +
        '<div class="chart-plot" style="position:relative;height:120px;">' +
        '<canvas id="' + canvasId + '" style="width:100%;height:100%;display:block;"></canvas>' +
        '</div>' +
        '</div>';
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

function buildSummaryCards(days, isWeek) {
    const totalCarbs = days.reduce((s, d) => s + d.carbs, 0);
    const avgCarbs = isWeek ? totalCarbs : totalCarbs / Math.max(1, days.length);
    const avgGlucose = isWeek
        ? days.reduce((s, d) => s + d.glucoseSum, 0) / Math.max(1, days.reduce((s, d) => s + d.glucoseCount, 0))
        : days.reduce((s, d) => s + (d.glucoseCount ? d.glucoseSum / d.glucoseCount : 0), 0) / Math.max(1, days.length);
    const avgWeight = isWeek
        ? days.reduce((s, d) => s + d.weightSum, 0) / Math.max(1, days.reduce((s, d) => s + d.weightCount, 0))
        : days.reduce((s, d) => s + (d.weightCount ? d.weightSum / d.weightCount : 0), 0) / Math.max(1, days.length);
    const avgWater = isWeek
        ? days.reduce((s, d) => s + d.waterSum, 0) / Math.max(1, days.reduce((s, d) => s + d.waterCount, 0))
        : days.reduce((s, d) => s + (d.waterCount ? d.waterSum / d.waterCount : 0), 0) / Math.max(1, days.length);
    const daysWithData = days.filter(d => d.carbs > 0 || d.glucoseCount > 0 || d.weightCount > 0 || d.waterCount > 0).length;

    return `<div class="metrics">
        <div class="metricbox"><div class="muted">${isWeek ? 'Total Carbs' : 'Avg Carbs / day'}</div><div class="metric">${avgCarbs.toFixed(0)}g</div><div class="muted">${daysWithData} ${isWeek ? 'days' : 'weeks'} with data</div></div>
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

    // Destroy old charts before replacing DOM
    destroyInsightsCharts();

    const data = insightsState.data;
    if (!data) {
        container.innerHTML = '<div class="dv-empty">No data available. Make sure you are signed in and have recorded data.</div>';
        return;
    }

    const days = isWeek ? aggregateByDay(data) : aggregateByMonth(data);
    const labels = days.map(d => d.label || formatInsightAxisLabel(d.date));
    const dates = days.map(d => d.date);
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
        ${buildSummaryCards(days, isWeek)}
        <div class="insights-charts">
            <div class="card">
                <h3>🍽️ Carbs (g)</h3>
                ${buildTrendChart(carbs, labels, 'carbs', 'g', dates)}
            </div>
            <div class="card">
                <h3>🩸 Glucose (mmol/L)</h3>
                ${buildTrendChart(glucose, labels, 'glucose', 'mmol/L', dates)}
            </div>
            <div class="card">
                <h3>⚖️ Weight (kg)</h3>
                ${buildTrendChart(weight, labels, 'weight', 'kg', dates)}
            </div>
            <div class="card">
                <h3>💧 Water (ml)</h3>
                ${buildTrendChart(water, labels, 'water', 'ml', dates)}
            </div>
        </div>
    `;

    // Initialize charts after DOM insertion
    initInsightsCharts();
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

    const toggle = $('insightsModeToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            insightsState.mode = insightsState.mode === 'week' ? 'month' : 'week';
            syncInsightsModeToggle();
            loadInsights();
        });
    }

    container.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        if (target.id === 'insightsPrev') {
            insightsPrev();
        } else if (target.id === 'insightsNext') {
            insightsNext();
        }
    });

    syncInsightsModeToggle();
    loadInsights();
}
