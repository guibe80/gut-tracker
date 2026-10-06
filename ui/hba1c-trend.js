/*
 * HbA1c trend helper: UI-only calculation from recorded spot glucose readings.
 * No database schema changes or new stored fields are required.
 *
 * Uses the ADAG (American Diabetes Association) glucose-to-HbA1c formula:
 *   HbA1c (%) = (mean_glucose_mg_dL + 46.7) / 28.7
 *   where mean_glucose_mg_dL = mean_glucose_mmol_L * 18
 *   then converts to mmol/mol: HbA1c (mmol/mol) = (HbA1c(%) - 2.15) * 10.929
 *
 * Weighting: fasting and before-meal readings are weighted more heavily
 * as they better reflect baseline glucose. Post-meal readings are de-weighted.
 *
 * Depends on globals from utils/ (loaded via <script> tags before this file):
 *   - $          (utils/html.js)
 *
 * Depends on globals from index.html inline script:
 *   - supabaseClient, user  (auth state)
 */

// Weight factor for each timing type. Higher = more representative of
// baseline glucose (closer to what HbA1c reflects).
const TIMING_WEIGHTS = {
    fasting: 1.5,
    before_meal: 1.5,
    bedtime: 1.0,
    random: 1.0,
    other: 1.0,
    '30_min_after': 0.5,
    '1_hour_after': 0.3,
    '2_hours_after': 0.2,
    '3_hours_after': 0.5,
};

// Default weight when timing is undefined or unknown.
const DEFAULT_WEIGHT = 1.0;

// Get the weight for a glucose reading based on its timing.
function timingWeight(timing) {
    return TIMING_WEIGHTS[timing] || DEFAULT_WEIGHT;
}

// Convert average glucose (mmol/L) to estimated HbA1c (mmol/mol).
// Uses the ADAG formula: HbA1c(%) = (mean_glucose_mg/dL + 46.7) / 28.7
function toMmolMol(mmolL) {
    const mg_dL = mmolL * 18;
    const pct = (mg_dL + 46.7) / 28.7;
    return (pct - 2.15) * 10.929;
}

// Format an HbA1c estimate for display.
function fmtEstimate(value) {
    return Number.isFinite(value) ? `${Math.round(value)} mmol/mol` : '—';
}

// Calculate weighted average glucose, estimated HbA1c, and total weight
// from an array of glucose readings. Each reading's timing determines its
// weight — fasting/before-meal readings are weighted higher.
function calculate(rows) {
    const weighted = rows
        .filter(r => Number(r.glucose_mmol_l) != null)
        .map(r => ({
            value: Number(r.glucose_mmol_l),
            weight: timingWeight(r.timing),
        }))
        .filter(r => Number.isFinite(r.value) && Number.isFinite(r.weight) && r.value > 0);

    if (!weighted.length) return null;

    const totalWeight = weighted.reduce((sum, r) => sum + r.weight, 0);
    const weightedSum = weighted.reduce((sum, r) => sum + r.value * r.weight, 0);
    const avg = weightedSum / totalWeight;
    const weightedCount = weighted.length;
    return { avg, hba1c: toMmolMol(avg), n: weightedCount };
}

// Render the HbA1c trend card HTML from a set of glucose readings.
function renderHbA1c(data) {
    const now = new Date();
    const periods = [
        { label: '7 days', days: 7 },
        { label: '4 weeks', days: 28 },
        { label: '8 weeks', days: 56 },
        { label: '12 weeks', days: 84 }
    ];
    const rows = periods.map(p => {
        const cutoff = new Date(now.getTime() - p.days * 86400000);
        const result = calculate(data.filter(r => new Date(r.measured_at) >= cutoff));
        return `<div class="metricbox"><div class="muted">${p.label}</div><div class="metric">${result ? fmtEstimate(result.hba1c) : '—'}</div><div class="muted">${result ? `avg ${result.avg.toFixed(1)} mmol/L · n=${result.n}` : 'Not enough data'}</div></div>`;
    }).join('');
    return `<h2>🩸 Estimated HbA1c trend</h2><p class="muted">Calculated from your recorded spot glucose readings using the ADAG glucose-to-HbA1c relationship (HbA1c = (mean_glucose mg/dL + 46.7) / 28.7). Fasting and pre-meal readings are weighted more heavily. This is an estimate, not a laboratory HbA1c result.</p><div class="metrics">${rows}</div><p class="muted" style="margin-top:10px">Use the 8–12 week estimates for trend interpretation; a single week's readings are much less reliable.</p>`;
}

// Install the HbA1c trend card into the Insights pane.
// Called once on page load; polls for supabaseClient/user availability.
function installHbA1cTrend() {
    if (window.__hba1cTrendInstalled) return;
    window.__hba1cTrendInstalled = true;

    const render = async () => {
        try {
            if (typeof supabaseClient === 'undefined' || !supabaseClient || typeof user === 'undefined' || !user || !supabaseClient.from) return;
            const now = new Date();
            const oldest = new Date(now.getTime() - 84 * 86400000).toISOString();
            const { data, error } = await supabaseClient
                .from('glucose_readings')
                .select('measured_at, glucose_mmol_l, timing')
                .eq('user_id', user.id)
                .gte('measured_at', oldest)
                .order('measured_at', { ascending: false });
            if (error) return;

            let card = document.getElementById('hba1cTrendCard');
            const insights = document.getElementById('insights');
            if (!insights) return;
            if (!card) {
                card = document.createElement('div');
                card.id = 'hba1cTrendCard';
                card.className = 'card';
                const snapshot = Array.from(insights.children).find(el => el.querySelector?.('#gsummary'));
                insights.insertBefore(card, snapshot || insights.firstChild);
            }

            card.innerHTML = renderHbA1c(data || []);
        } catch (e) {
            console.error('[HbA1c] render error:', e.message);
        }
    };

    const waitForApp = () => {
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof user !== 'undefined' && user) {
                render();
            } else {
                setTimeout(waitForApp, 1000);
            }
        } catch (e) {
            setTimeout(waitForApp, 1000);
        }
    };
    waitForApp();
    window.addEventListener('focus', render);
}
