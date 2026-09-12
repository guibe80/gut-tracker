# Gut + Glucose Tracker — Engineering Context

Last checked: 2026-09-12

## Purpose and architecture

This is a static, installable PWA for logging meals, glucose readings, gut symptoms, and bowel movements. It uses Supabase Auth and the Supabase Data API directly from the browser. There is no build system or package manager: `index.html` contains the app markup, styles, and client-side JavaScript.

Key files:

- `index.html` — all screens, form behaviour, Supabase reads/writes, rendering, import/export.
- `version.js` and `VERSION` — the application version; update both for a feature or fix release.
- `sw.js` — service-worker cache version and a compatibility patch for older app-shell behaviour.
- `setup.html` — local storage setup for the Supabase publishable key.
- `supabase/` — SQL helpers that must be run manually in the Supabase SQL editor where relevant.
- `V3-MIGRATION.md`, `V3.3-ROADMAP.md`, `V4-ROADMAP.md` — product plans and migration notes.

## Development rules

- Never work directly on `main`. Use `feature/…`, `fix/…`, or `refactor/…` branches and merge via a pull request.
- Preserve unrelated worktree changes. Do not commit keys, `.env` files, or personal health data.
- Use Semantic Versioning: backwards-compatible features increment MINOR; fixes increment PATCH.
- Before a commit: review `git status` and the diff, run relevant checks, and run the production build if one exists.

## Live Supabase schema (checked 2026-09-12)

Project ref: `sywbgjdxptvwtjfrjgfk` (Tracker, eu-west-2). The relevant public tables have RLS enabled.

### Meals and nutrition

`meals` is the meal-level record. Relevant nullable numeric fields:

- `estimated_carbohydrate_g`
- `protein_estimate_g`
- `fibre_estimate_g`

`meal_foods` is an optional free-text/structured child record with `food_name`, `portion`, `portion_unit`, `estimated_carbohydrate_g`, and `estimated_fibre_g`. Today’s PWA stores the whole meal description as one `meal_foods` row; its meal-level nutrition belongs on `meals`.

The app's `insertWithSchemaFallback` / `updateWithSchemaFallback` intentionally remove a field if an older database lacks it. Keep new optional fields in that mechanism so older installations remain usable.

## Current implementation notes

- Meals load from `meals`, then load associated `meal_foods` for their labels and trigger notes.
- The food form saves meal nutrition on `meals`; editing repopulates the same inputs.
- The authenticated browser client must only use the publishable key. Never put a `service_role` key in browser code.
- `sw.js` imports `version.js`; updating the app version invalidates the PWA cache.

## Improvement backlog

- [x] Add meal-level fibre entry (`meals.fibre_estimate_g`) to the food form, edit flow, and save payload.
- [ ] Display meal nutrition (carbohydrate, protein, fibre) in recent meals, timeline, and insights.
- [ ] Align glucose form field names with the current live schema: the UI currently writes `context` / `estimated_meal_carbs_g`, while the live database exposes `reading_context` / `carbohydrate_estimate_g`. The existing fallback avoids failure but does not save those values.
- [ ] Add automated browser-level checks for the static PWA; currently verification is syntax and manual smoke testing.
- [ ] Commit schema migrations alongside application changes rather than relying only on manually run SQL helpers.
- [ ] Build V3.3 nutrition visualisations, then follow the V4 AI-meal-analysis roadmap.

## Verification checklist for a UI/data change

1. Check the live table columns and RLS before changing Supabase payloads.
2. Exercise new meal creation and editing with a normal user account; confirm the value persists after reload.
3. Run `node --check version.js`, `node --check sw.js`, and `git diff --check` at minimum.
4. Increment `version.js` and `VERSION` for a completed feature/fix, then verify a reload receives the new service-worker cache.
