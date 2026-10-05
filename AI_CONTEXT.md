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

Supabase Auth is used. It stores **Supabase publishable key** in local explorer, not in code. It must be stored first by running setup.html. Once stored is possible use githug oauth to access the supabase and the PWA. 

Users are identified by:
`auth.uid()`

User-specific tables use `user_id`.

RLS must never be bypassed from the client.

## Main entities

### profiles
One profile per authenticated user.

### meals
Records meals eaten by the user.

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

# AI Context

## App
- Static installable PWA; no build system or package manager. `index.html` contains UI, styles, and app logic; data/auth use Supabase directly.
- `setup.html` stores the Supabase publishable key in browser local storage. Never use a service-role key in client code.
- `sw.js` handles caching and legacy app-shell compatibility rewriting. Do not remove or simplify it without checking installed-client behavior.
- Keep this file as the concise project reference. `AGENTS.md` contains Git and release workflow rules.

## Data and security
- Schema snapshot: `supabase/SCHEMA-SNAPSHOT.md`; generated types: `supabase/types.ts`. Snapshot last checked 2026-09-12; verify live columns and RLS before changing queries or payloads.
- Supabase Auth identifies users with `auth.uid()`; user data uses `user_id`. Preserve RLS and foreign keys.
- Never commit secrets, keys, or personal health data. Keep future AI credentials server-side; validate AI output and require user review before saving.
- Database changes require a migration; regenerate `types.ts` and update the schema snapshot.
- Meal nutrition belongs on `meals` (`estimated_carbohydrate_g`, `protein_estimate_g`, `fibre_estimate_g`). `meal_foods` stores food descriptions and optional child details. Preserve schema-fallback handling for optional columns.
- Check glucose field mapping before edits: UI fields `context` / `estimated_meal_carbs_g` differ from snapshot fields `reading_context` / `carbohydrate_estimate_g`.

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