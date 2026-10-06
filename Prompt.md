# Refactoring Session 4 — Prompt

## Context

You are continuing the modularisation of `index.html` (currently ~1,165 lines of inline JS).
The app is a static PWA with no build system — `<script>` tags load plain JS files globally.

### Already completed:
- **Session 1 (Stage 1)**: Extracted 11 datetime functions → `utils/datetime.js` + 24 unit tests
- **Session 2 (Stage 2)**: Extracted 14 more pure functions across 4 modules → 40 unit tests + README/sw.js updates
- **Session 3 (Stage 2)**: Extracted 8 Supabase data-access functions → `services/data-service.js` + 19 unit tests

### Current state:
- `index.html` is ~1,165 lines (down from ~1,201)
- `utils/` modules: datetime.js, supabase-helpers.js, validation.js, html.js, data-mapping.js
- `services/` modules: data-service.js (loadPage, loadGlucose, loadWeights, load, insertWithSchemaFallback, updateWithSchemaFallback, save, saveSilent, deleteEntry)
- All extracted functions are loaded via `<script>` tags before the main app script
- All function calls in `index.html` resolve to module versions (global scope)
- `make check`: ✅ | 85 unit tests: ✅ | 9 smoke tests: ✅
- Latest commit: `7932ef2` (pushed to `core/refactoring`)

## What remains to extract from index.html (from Phase 1 report)

### Stage 3 — Day-view subsystem (next target)
Functions still inline in `index.html`:
- `dvFetch(isoDate)` — fetches all data for a single day from Supabase
- `dvGetEvents(data, type)` — transforms raw records into timeline events
- `dvBuild()` — builds the day-view DOM (toggles, time axis, lanes, events)
- `dvRender()` — orchestrates fetch + build with date-change guards
- `dvGoTo(dateIso)` — navigates to a date
- `dvToggle(type)` — toggles a day-view lane
- `dvToday()` / `dvPrev()` / `dvNext()` — date navigation

Constants: `dvState`, `DV_LANE_ORDER`, `DV_LANE_LABEL`, `DV_LANE_ICON`, `DV_REDIRECT`
Dependencies: `supabaseClient`, `user`, `dvDayStart`, `dvDayEnd`, `dvFormatDate`, `dvParseDate`, `dvPercentThrough`, `dvFormatHour`, `parseTzNotes`, `esc`, `fmt`, `$`

### Stage 4 — Rendering logic
- `render()` — list views, insights, timeline, glucose summary
- `updatePagers()` — pagination button state

### Stage 5 — Import/export
- `getMigrationState()` — loads existing data for dedup
- `hasImportedFood(state, source, dt, mealType, foodName)` — dedup check
- `hasImportedSymptom(state, source, field, dt, type, severity)` — dedup check
- `hasImportedBowel(state, source, dt, bristol)` — dedup check
- V2 import handler (event listener with parse/map/insert logic)

### Stage 6 — UI controllers
- `setSync`, `updateSetupLink`, `setupClient`, `reconnectAndReload`, `setMsg`, `reset`, `showApp`, `mealOptions`
- `editState`, `setFormMode`, `openEditForm`
- Form submit handlers (foodForm, glucoseForm, symForm, bowelForm, weightForm)
- `num()` helper, clear buttons, tab switching, pagination, timeline controls
- Export/import handlers, signout, checkUpdate, auth handlers

## Plan for Session 4

**Goal:** Extract the day-view subsystem into `ui/dayview-renderer.js`

### Steps:
1. Read the current `index.html` script section to see exact function signatures and dependencies
2. Create `ui/dayview-renderer.js` with all `dv*` functions and constants
3. These functions need access to globals: `supabaseClient`, `user`, `$`, `dvDayStart`, `dvDayEnd`, `dvFormatDate`, `dvParseDate`, `dvPercentThrough`, `dvFormatHour`, `parseTzNotes`, `esc`, `fmt`
4. Remove function definitions from `index.html`, add script tag, update `sw.js` cache, update README
5. Write unit tests for the pure logic in `dvGetEvents` (data transformation)
6. Run `make check`, `node --test tests/unit/*.test.js`, `make smoke`
7. Commit and push

### Testability notes:
- `dvGetEvents` is the most testable — it transforms raw Supabase records into timeline event objects (pure data mapping)
- Can unit test: each type (food/glucose/gut/bowel/weight), filtering by date range, sorting
- `dvFetch` and `dvRender` depend on DOM and Supabase — harder to unit test, rely on smoke tests
- `dvPrev`/`dvNext`/`dvToday`/`dvGoTo` modify `dvState` — can test date arithmetic if we mock `dvState`, `dvFormatDate`, `dvParseDate`, `dvDayStart`, `dvDayEnd`
