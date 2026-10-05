# Refactoring Session 3 — Prompt

## Context

You are continuing the modularisation of `index.html` (currently ~1,185 lines of inline JS).
The app is a static PWA with no build system — `<script>` tags load plain JS files globally.

### Already completed:
- **Session 1 (Step 1)**: Extracted 11 datetime functions → `utils/datetime.js` + 24 unit tests
- **Session 2 (Step 2)**: Extracted 14 more pure functions across 4 modules + 40 unit tests + README/sw.js updates

### Current state:
- `index.html` is ~1,185 lines (down from ~1,201)
- All `utils/` functions are loaded via `<script>` tags before the main app script
- All function calls in `index.html` resolve to module versions (global scope)
- `make check`: ✅ | 66 unit tests: ✅ | 9 smoke tests: ✅
- Latest commit: `de16515` (pushed to `core/refactoring`)
- `Prompt.md` created for this session

## What remains to extract from index.html (from Phase 1 report)

### Tier 2 — Supabase service layer (next target)
Functions still inline in `index.html`:
- `loadPage(table, orderColumn, pageName)` — paginated Supabase select
- `loadGlucose()` / `loadWeights()` — wrappers with schema-error fallback
- `load()` — loads all 5 tables + meal_foods in parallel
- `insertWithSchemaFallback(table, payload)` — insert with retry + column fallback
- `updateWithSchemaFallback(table, id, payload)` — same for updates
- `save(table, payload, msgId)` — dispatches insert vs update
- `saveSilent(table, payload)` — insert without messages
- `deleteEntry(table, id)` — delete + cascade for meal_foods

### Tier 3 — V2 import logic
- `getMigrationState()` — loads existing data for dedup
- `hasImportedFood(state, source, dt, mealType, foodName)` — dedup check
- `hasImportedSymptom(state, source, field, dt, type, severity)` — dedup check
- `hasImportedBowel(state, source, dt, bristol)` — dedup check
- V2 import handler (event listener with parse/map/insert logic)

### Tier 4 — Rendering & UI controllers
- `render()` — list views, insights, timeline
- Day-view rendering engine: `dvFetch`, `dvBuild`, `dvRender`, `dvGetEvents`
- Day-view navigation: `dvGoTo`, `dvPrev`, `dvNext`, `dvToday`, `dvToggle`
- Form handlers: `setFormMode`, `openEditForm`, all form submit handlers
- Event wire-up: tab switching, pagination, timeline navigation

## Plan for Session 3

**Goal:** Extract the Supabase service layer into `services/data-service.js`

### Steps:
1. Read the current `index.html` script section to see exact function signatures and dependencies
2. Create `services/data-service.js` with all Tier 2 functions
3. These functions need access to globals: `supabaseClient`, `user`, `page`, `pageSize`, `totals`, `mealFoods`, `setSync`, `setMsg`, `render`, `editState`
4. Remove function definitions from `index.html`, update `sw.js` cache, update README
5. Write unit tests for testable pure logic within these functions
6. Run `make check`, `node --test tests/unit/*.test.js`, `make smoke`
7. Commit and push

### Safety rules:
- Do NOT change any logic — just move functions verbatim
- Do NOT change database schema, auth, or API contracts
- Do NOT change UI behaviour
- Run all tests after each extraction
