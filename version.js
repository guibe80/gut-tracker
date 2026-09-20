const APP_VERSION = '3.6.0';

const SUPABASE_KEY_STORAGE = 'gut_tracker_publishable_key';

function isLikelySupabasePublishableKey(value) {
    return /^sb_publishable_[A-Za-z0-9._-]+$/.test(value) || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function getStoredSupabaseKey() {
    return localStorage.getItem(SUPABASE_KEY_STORAGE) || '';
}

function storeSupabaseKey(value) {
    localStorage.setItem(SUPABASE_KEY_STORAGE, value);
}

function clearStoredSupabaseKey() {
    localStorage.removeItem(SUPABASE_KEY_STORAGE);
}

// HbA1c trend helper: UI-only calculation from recorded spot glucose readings.
// No database schema changes or new stored fields are required.
function installHbA1cTrend() {
    if (window.__hba1cTrendInstalled) return;
    window.__hba1cTrendInstalled = true;

    const toMmolMol = mmolL => {
        const pct = (mmolL + 2.59) / 1.59;
        return (pct - 2.15) * 10.929;
    };

    const fmtEstimate = value => Number.isFinite(value) ? `${Math.round(value)} mmol/mol` : '—';

    const calculate = rows => {
        const values = rows.map(r => Number(r.glucose_mmol_l)).filter(Number.isFinite);
        if (!values.length) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { avg, hba1c: toMmolMol(avg), n: values.length };
    };

    const render = async () => {
        try {
            if (!window.supabaseClient || !window.user || !window.supabaseClient.from) return;
            const now = new Date();
            const periods = [
                { label: '7 days', days: 7 },
                { label: '4 weeks', days: 28 },
                { label: '8 weeks', days: 56 },
                { label: '12 weeks', days: 84 }
            ];
            const oldest = new Date(now.getTime() - 84 * 86400000).toISOString();
            const { data, error } = await window.supabaseClient
                .from('glucose_readings')
                .select('measured_at, glucose_mmol_l')
                .eq('user_id', window.user.id)
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

            const current = calculate(data.filter(r => new Date(r.measured_at) >= new Date(now.getTime() - 7 * 86400000)));
            const rows = periods.map(p => {
                const cutoff = new Date(now.getTime() - p.days * 86400000);
                const result = calculate(data.filter(r => new Date(r.measured_at) >= cutoff));
                return `<div class="metricbox"><div class="muted">${p.label}</div><div class="metric">${result ? fmtEstimate(result.hba1c) : '—'}</div><div class="muted">${result ? `avg ${result.avg.toFixed(1)} mmol/L · n=${result.n}` : 'Not enough data'}</div></div>`;
            }).join('');

            const direction = current ? (current.hba1c <= 48 ? 'Estimated range is around the low-40s at present.' : 'Estimated value is above the low-40s; continue tracking.') : 'Add more glucose readings to establish a trend.';
            card.innerHTML = `<h2>🩸 Estimated HbA1c trend</h2><p class="muted">Calculated from your recorded spot glucose readings using the ADAG glucose-to-HbA1c relationship. This is an estimate, not a laboratory HbA1c result.</p><div class="metrics">${rows}</div><p class="muted" style="margin-top:10px">${direction} More complete sampling over 8–12 weeks gives a more meaningful trend than a single week's readings.</p>`;
        } catch (_) {
            // Keep the tracker usable if the optional trend calculation is unavailable.
        }
    };

    const waitForApp = () => {
        if (window.supabaseClient && window.user) render();
        else setTimeout(waitForApp, 1000);
    };
    waitForApp();
    window.addEventListener('focus', render);
}

installHbA1cTrend();
