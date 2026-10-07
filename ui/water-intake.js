/*
 * ui/water-intake.js
 *
 * Water intake tracking: daily progress toward a personalised target,
 * visualised as an animated water bottle.
 *
 * Phase 1: All water entries are stored in localStorage (date-keyed).
 * Meal/drink integration adds entries when a drink meal is saved.
 *
 * Depends on globals from utils/ and index.html (loaded via <script>):
 *   - $, dvFormatDate, dvParseDate, dvDayStart, dvDayEnd, esc, fmt  (utils)
 *   - meals, weights, user, supabaseClient                        (index.html)
 *   - render()                                                    (ui/render.js)
 *
 * Pure functions (testable without DOM):
 *   calculateWaterTarget(weightKg), parseDrinkVolume(text), getDateKey()
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

// Default target when no weight data is available (WHO general rec)
const DEFAULT_WATER_TARGET_ML = 2000;

// Minimum target regardless of weight
const MIN_WATER_TARGET_ML = 1500;

// Standard 30 ml per kg of body weight
const WATER_ML_PER_KG = 30;

// Step size for the + button
const WATER_ENTRY_STEP_ML = 250;

// Storage key in localStorage
const WATER_STORAGE_KEY = 'water_intake';

/* ------------------------------------------------------------------ */
/* Pure calculation functions                                        */
/* ------------------------------------------------------------------ */

/**
 * Calculate a personalised daily water target from body weight.
 *
 * Formula: 30 ml × weight_kg, minimum 1500 ml.
 * If weight_kg is null/undefined/NaN, falls back to 2000 ml.
 *
 * @param {number|null} weightKg - Most recent weight in kg.
 * @returns {number} Recommended daily intake in ml.
 */
function calculateWaterTarget(weightKg) {
    if (weightKg == null || isNaN(Number(weightKg))) {
        return DEFAULT_WATER_TARGET_ML;
    }
    const target = Math.round(Number(weightKg) * WATER_ML_PER_KG / 50) * 50;
    return Math.max(MIN_WATER_TARGET_ML, target);
}

/**
 * Parse a water volume (in ml) from a free-text drink description.
 * Looks for "water"/"agua" mentions and extracts the nearest volume.
 *
 * Supported units: ml, l, cl, oz.
 * Returns null if the text doesn't mention water or no volume is found.
 *
 * @param {string} text - e.g. "250ml water", "500 ml agua, juice"
 * @returns {number|null} Volume in ml (rounded), or null.
 */
function parseDrinkVolume(text) {
    if (!text) return null;
    const lower = String(text).toLowerCase();
    if (!lower.includes('water') && !lower.includes('agua')) return null;

    // Find all volume matches with their positions
    const volumeRegex = /(\d+(?:\.\d+)?)\s*(ml|l|cl|oz)\b/gi;
    let match;
    let bestMatch = null;
    let bestDist = Infinity;
    const waterIndices = [];
    for (const term of ['water', 'agua']) {
        let idx = lower.indexOf(term);
        while (idx !== -1) { waterIndices.push(idx); idx = lower.indexOf(term, idx + 1); }
    }
    while ((match = volumeRegex.exec(text)) !== null) {
        for (const wi of waterIndices) {
            const dist = Math.abs(match.index - wi);
            if (dist < bestDist) { bestDist = dist; bestMatch = match; }
        }
    }
    if (!bestMatch || bestDist > 30) return null;

    const value = parseFloat(bestMatch[1]);
    const unit = bestMatch[2].toLowerCase();
    const ml = {
        ml: value,
        l: value * 1000,
        cl: value * 10,
        oz: value * 29.5735
    }[unit];
    return ml ? Math.round(ml) : null;
}

/**
 * Get today's date as a YYYY-MM-DD key for storage.
 * Uses dvFormatDate (local time) to match the day-view pattern.
 */
function getDateKey(date) {
    return dvFormatDate(date || new Date());
}

/* ------------------------------------------------------------------ */
/* Storage (localStorage)                                              */
/* ------------------------------------------------------------------ */

/**
 * Read all water data from localStorage.
 * Returns a date-keyed object: { "2025-06-15": [{ id, amountMl, source, ... }], ... }
 */
function getWaterStorage() {
    try {
        const raw = localStorage.getItem(WATER_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/**
 * Persist water data to localStorage.
 */
function saveWaterStorage(data) {
    try {
        localStorage.setItem(WATER_STORAGE_KEY, JSON.stringify(data));
    } catch {
        // Storage full or disabled — silently fail
    }
}

/**
 * Get all water entries for a given date key.
 */
function getWaterEntries(dateKey) {
    const data = getWaterStorage();
    return data[dateKey] || [];
}

/**
 * Sum all water entries for a given date key.
 */
function getWaterTotal(dateKey) {
    return getWaterEntries(dateKey).reduce((sum, e) => sum + e.amountMl, 0);
}

/**
 * Add a water entry for a given date.
 * Returns the created entry.
 */
function addWaterEntry(dateKey, amountMl, source, mealId) {
    const data = getWaterStorage();
    const entry = {
        id: source === 'meal' && mealId ? 'meal_' + mealId : Date.now().toString(),
        amountMl: Math.round(amountMl),
        source: source || 'manual',
        createdAt: new Date().toISOString()
    };
    if (mealId) entry.mealId = mealId;
    if (!data[dateKey]) data[dateKey] = [];
    // If a meal-sourced entry already exists for this meal, update it
    if (source === 'meal' && mealId) {
        data[dateKey] = data[dateKey].filter(e => !(e.source === 'meal' && e.mealId === mealId));
    }
    data[dateKey].push(entry);
    saveWaterStorage(data);
    return entry;
}

/**
 * Remove a water entry by ID.
 */
function removeWaterEntry(dateKey, entryId) {
    const data = getWaterStorage();
    if (!data[dateKey]) return;
    data[dateKey] = data[dateKey].filter(e => e.id !== entryId);
    if (data[dateKey].length === 0) delete data[dateKey];
    saveWaterStorage(data);
}

/* ------------------------------------------------------------------ */
/* Target calculation (uses app globals)                              */
/* ------------------------------------------------------------------ */

/**
 * Calculate the water target for the current user.
 * Uses the most recent weight entry if available.
 */
function getWaterTarget() {
    if (!weights || weights.length === 0) return DEFAULT_WATER_TARGET_ML;
    const latest = weights[0];
    return calculateWaterTarget(latest.weight_kg);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                         */
/* ------------------------------------------------------------------ */

let waterState = { date: getDateKey() };

/**
 * Render the complete water intake UI for the current waterState.date.
 * Called from render() in render.js, and directly after user actions.
 */
function renderWaterIntake() {
    const bottle = $('waterBottle');
    const fill = $('waterFill');
    const consumedEl = $('waterConsumed');
    const targetEl = $('waterTarget');
    const pctEl = $('waterPct');
    const targetLEl = $('waterTargetL');
    const entriesEl = $('waterEntries');
    const dateInput = $('waterDate');

    if (!bottle || !consumedEl || !targetEl || !pctEl || !fill) return;

    const target = getWaterTarget();
    const fromWeight = weights && weights.length > 0;
    const targetNote = $('waterTargetNote');
    if (targetNote) {
        targetNote.textContent = fromWeight ? ' (from last weigh-in)' : ' (general recommendation)';
    }
    const entries = getWaterEntries(waterState.date);
    const consumed = getWaterTotal(waterState.date);
    const pct = target > 0 ? Math.round((consumed / target) * 100) : 0;
    const fillPct = Math.min(100, pct);

    // Update date input
    if (dateInput) dateInput.value = waterState.date;

    // Update bottle fill
    fill.style.setProperty('--water-fill-pct', fillPct + '%');

    // Update text
    consumedEl.textContent = consumed.toLocaleString('en-GB');
    targetEl.textContent = target.toLocaleString('en-GB');
    pctEl.textContent = pct + '%';
    targetLEl.textContent = (target / 1000).toFixed(1);

    // Render entries list
    const sorted = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    entriesEl.innerHTML = sorted.length
        ? sorted.map(e => waterEntryHtml(e, waterState.date)).join('')
        : '<p class="muted">No water recorded today.</p>';
}

/**
 * Build a single water entry row (reuses .entry pattern from render.js).
 */
function waterEntryHtml(entry, dateKey) {
    const time = fmt(entry.createdAt);
    const source = entry.source === 'meal' ? 'from meal' : 'manual';
    return `<div class="entry">
        <strong>${entry.amountMl} ml</strong> · <span class="muted">${time}</span> · <span class="muted">${source}</span>
        <div class="entry-actions">
            <button type="button" class="entry-delete" data-water-date="${esc(dateKey)}" data-water-id="${esc(entry.id)}">Delete</button>
        </div>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Event handlers                                                      */
/* ------------------------------------------------------------------ */

function initWaterIntake() {
    // Date navigation
    const prevBtn = $('waterPrevDay');
    const nextBtn = $('waterNextDay');
    const todayBtn = $('waterToday');
    const dateInput = $('waterDate');

    if (prevBtn) prevBtn.addEventListener('click', waterPrevDay);
    if (nextBtn) nextBtn.addEventListener('click', waterNextDay);
    if (todayBtn) todayBtn.addEventListener('click', waterToday);
    if (dateInput) dateInput.addEventListener('change', () => {
        if (dateInput.value) { waterState.date = dateInput.value; renderWaterIntake(); }
    });

    // Add water buttons
    if ($('waterAdd250')) {
        $('waterAdd250').addEventListener('click', () => {
            addWaterEntry(waterState.date, WATER_ENTRY_STEP_ML, 'manual');
            renderWaterIntake();
        });
    }
    if ($('waterAdd500')) {
        $('waterAdd500').addEventListener('click', () => {
            addWaterEntry(waterState.date, WATER_ENTRY_STEP_ML * 2, 'manual');
            renderWaterIntake();
        });
    }

    // Delete water entry (event delegation)
    if ($('waterEntries')) {
        $('waterEntries').addEventListener('click', event => {
            const btn = event.target.closest('.entry-delete');
            if (!btn) return;
            const date = btn.dataset.waterDate;
            const id = btn.dataset.waterId;
            removeWaterEntry(date, id);
            renderWaterIntake();
        });
    }
}

function waterPrevDay() {
    const d = new Date(dvParseDate(waterState.date).getTime());
    d.setDate(d.getDate() - 1);
    waterState.date = dvFormatDate(d);
    renderWaterIntake();
}

function waterNextDay() {
    const d = new Date(dvParseDate(waterState.date).getTime());
    d.setDate(d.getDate() + 1);
    waterState.date = dvFormatDate(d);
    renderWaterIntake();
}

function waterToday() {
    waterState.date = getDateKey();
    renderWaterIntake();
}

/* ------------------------------------------------------------------ */
/* Meal integration: add water from drink meals                       */
/* ------------------------------------------------------------------ */

/**
 * After a drink meal is saved, parse the food names for water volume
 * and add a corresponding water entry.
 *
 * Called from the food form submit handler.
 * Must run AFTER the meal is saved (so we have the meal ID).
 *
 * @param {string} mealId - The saved meal's ID
 * @param {string} foodsText - The raw foods textarea value
 */
function addWaterFromMeal(mealId, foodsText) {
    if (!mealId) return null;
    const volume = parseDrinkVolume(foodsText);
    if (!volume || volume <= 0) return null;
    const dateKey = getDateKey();
    addWaterEntry(dateKey, volume, 'meal', mealId);
    return volume;
}

/**
 * Remove water entries associated with a specific meal ID.
 * Called when a meal is deleted.
 */
function removeWaterFromMeal(mealId) {
    if (!mealId) return;
    const data = getWaterStorage();
    let changed = false;
    for (const dateKey of Object.keys(data)) {
        const before = data[dateKey].length;
        data[dateKey] = data[dateKey].filter(e => !(e.source === 'meal' && e.mealId === mealId));
        if (data[dateKey].length !== before) {
            changed = true;
            if (data[dateKey].length === 0) delete data[dateKey];
        }
    }
    if (changed) saveWaterStorage(data);
}
