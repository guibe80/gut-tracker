# Gut Tracker — AI Development Context

## Project

Gut Tracker is a personal health tracking application.

## Database

Supabase PostgreSQL.

The authoritative database schema is:
`supabase/SCHEMA-SNAPSHOT.md`

The authoritative TypeScript definitions are:
`supabase/types.ts`

Do not assume database structures that aren't present in these files.

## Authentication

Supabase Auth is used. The **Supabase publishable key** is stored in browser `localStorage` by `setup.html` (via `version.js` helpers). It is never committed to code or git (see `.gitignore`).

Users are identified by:
`auth.uid()`

User-specific tables use `user_id`.

RLS must never be bypassed from the client.

## Main entities

### profiles
One profile per authenticated user.

### meals
Records meals eaten by the user. Includes nutrition estimates and (since 4.14.0) an optional `triggers` text[] column.

### meal_foods
Individual foods belonging to a meal.

### foods
Shared food reference database.

### glucose_readings
Blood glucose measurements, optionally associated with a meal.

### gut_symptoms
Digestive symptoms, optionally associated with a meal.

### bowel_movements
Bowel movement records.

### daily_context
Daily lifestyle/context information.

### weight_entries
Weight measurements.

### water_intake
Water intake entries with source attribution (manual vs meal).

### five_a_day_entries
5 A Day fruit and vegetable portion tracking.

# AI Context

## App
- Static installable PWA; no build system or package manager. `index.html` contains UI, styles, and app logic; data/auth use Supabase directly.
- `setup.html` stores the Supabase publishable key in browser `localStorage`. Never use a service-role key in client code.
- `sw.js` handles caching and legacy app-shell compatibility rewriting. Do not remove or simplify it without checking installed-client behavior.
- Keep this file as the concise project reference. `AGENTS.md` contains Git and release workflow rules.

## Architecture

### Module layout
- `utils/` — Pure utility functions (datetime, validation, HTML escaping, data mapping, Supabase helpers, 5 A Day calculator)
- `services/` — Supabase data access layer (data-service, v2-import, five-a-day-repository, five-a-day-catalogue)
- `ui/` — UI rendering and event controllers (render, form-controllers, dayview-renderer, water-intake, insights-view, five-a-day, hba1c-trend, timing-utils, chartjs-config)
- `index.html` — App shell, auth flow, main script (loads all modules via `<script>` tags)

### Key files
- `version.js` — APP_VERSION constant + Supabase key storage helpers. Single source of truth for version.
- `VERSION` — Mirrors version.js. Keep both aligned for releases.
- `sw.js` — Service worker: asset caching, offline shell, legacy app-shell compatibility patching.
- `manifest.webmanifest` — PWA install manifest.

### Data and security
- Schema snapshot: `supabase/SCHEMA-SNAPSHOT.md`; generated types: `supabase/types.ts`. Snapshot last checked 2026-10-11; verify live columns and RLS before changing queries or payloads.
- Supabase Auth identifies users with `auth.uid()`; user data uses `user_id`. Preserve RLS and foreign keys.
- Never commit secrets, keys, or personal health data. Keep future AI credentials server-side; validate AI output and require user review before saving.
- Database changes require a migration; regenerate `types.ts` and update the schema snapshot.
- Meal nutrition belongs on `meals` (`estimated_carbohydrate_g`, `protein_estimate_g`, `fibre_estimate_g`, `triggers`). `meal_foods` stores food descriptions and optional child details. Preserve schema-fallback handling for optional columns.
- Glucose field mapping (UI vs snapshot): UI `context` ↔ snapshot `context`, UI `estimated_meal_carbs_g` ↔ snapshot `estimated_meal_carbs_g`, UI `minutes_from_meal` ↔ snapshot `minutes_from_meal`. All match the current snapshot; do not rename without re-checking.

## Change and verify
- Preserve existing behavior; make small, focused changes.
- **Required checks before every change** (enforced via `make check`):
  1. `node --check version.js` and `node --check sw.js` — JavaScript syntax validation
  2. HTML structure validation for `index.html` and `setup.html` (DOCTYPE, `<html>`, `<body>` tags)
  3. `git diff --check` — whitespace error detection
- **Required checks before merging a refactor** (`make smoke`):
  - Browser smoke tests via Playwright (see `tests/smoke.test.js`): app loads, auth screen visible, service worker registers, navigation tabs present, manifest valid
  - For UI/data changes: test create/edit and reload with a normal user
  - For PWA changes: test offline and update behavior
- `version.js` drives the displayed app and service-worker cache version; keep `VERSION` aligned for releases. Do not bump versions for refactoring alone.
- Product references: `V3-MIGRATION.md`, `V3.3-ROADMAP.md`, `V4-ROADMAP.md`.

## Historical notes
- `Prompt.md`, `REFACTORING-STEP-1.md`, and `TRIGGER_FIELDS_PLAN.md` document earlier refactoring sessions and the IBS trigger feature. They are kept for history but are not authoritative for current architecture — this file is.