/*
 * HbA1c trend helper: UI-only calculation from recorded spot glucose readings.
 * No database schema changes or new stored fields are required.
 *
 * Uses the ADAG (American Diabetes Association) glucose-to-HbA1c formula:
 *   HbA1c (%) = (28.7 * mean_glucose_mmol_per_L + 46.7) / 25.7
 * then converts to mmol/mol: HbA1c (mmol/mol) = (HbA1c(%) - 2.15) * 10.929
 *
 * Depends on globals from utils/ (loaded via <script> tags before this file):
 *   - $          (utils/html.js)
 *
 * Depends on globals from index.html inline script:
 *   - supabaseClient, user  (auth state)
 */

// Convert average glucose (mmol/L) to estimated HbA1c (mmol/mol).
function toMmolMol(mmolL) {
    const pct = (28.7 * mmolL + 46.7) / 25.7;
    return (pct - 2.15) * 10.929;
}

// Format an HbA1c estimate for display.
function fmtEstimate(value) {
    return Number.isFinite(value) ? `${Math.round(value)} mmol/mol` : '—';
}

// Calculate average glucose, estimated HbA1c, and count from a rows array.
function calculate(rows) {
    const values = rows.map(r => Number(r.glucose_mmol_l)).filter(Number.isFinite);
    if (!values.length) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { avg, hba1c: toMmolMol(avg), n: values.length };
}

// Render the HbA1c trend card from a set of glucose readings.
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
    return `<h2>🩸 Estimated HbA1c trend</h2><p class="muted">Calculated from your recorded spot glucose readings using the ADAG glucose-to-HbA1c relationship. This is an estimate, not a laboratory HbA1c result.</p><div class="metrics">${rows}</div><p class="muted" style="margin-top:10px">Use the 8–12 week estimates for trend interpretation; a single week's readings are much less reliable.</p>`;
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
                .select('measured_at, glucose_mmol_l')
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
        } catch (_) {
            // Keep the tracker usable if the optional trend calculation is unavailable.
        }
    };

    const waitForApp = () => {
        try {
            if (typeof supabaseClient !== 'undefined' && supabaseClient && typeof user !== 'undefined' && user) render();
            else setTimeout(waitForApp, 1000);
        } catch (_) {
            setTimeout(waitForApp, 1000);
        }
    };
    waitForApp();
    window.addEventListener('focus', render);
}
