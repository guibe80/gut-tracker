# Gut + Glucose Tracker

A privacy-first, installable PWA for tracking meals, blood glucose, gut symptoms,
bowel movements, and weight — backed by Supabase PostgreSQL with Row Level Security.

## What it does

- Record meals with carbs, protein, fibre, FODMAP triggers, and notes
- Log spot glucose readings (mmol/L) with timing context
- Track gut symptoms and bowel movements (Bristol type)
- Record weight entries
- Track daily water intake with an interactive visualised bottle
- Track 5 A Day fruit and vegetable portions against UK NHS guidance
- Visualise everything on a daily timeline with toggleable lanes
- See insights: glucose averages, trigger associations
- Import V2 JSON backups and export V3 data
- Works offline as a PWA with a service worker

## Local setup & run

No build system. Serve the static files with any HTTP server:

```bash
# Option 1: Use the provided Makefile
make serve
# → http://localhost:8080

# Option 2: Python
python3 -m http.server 8080

# Option 3: Node
npx serve .
```

1. Open `http://localhost:8080/setup.html`
2. Paste your Supabase **publishable** key (from Project Settings → API)
3. Click "Save and open tracker" (or use GitHub sign-in)
4. You're at `index.html` — sign in or create an account

> The publishable key is stored in browser `localStorage` only. Never commit secrets.

## Repo map

```
gut-tracker/
├── index.html              # Main app: UI, auth, inline app shell script
├── setup.html              # First-run page: stores Supabase publishable key
├── sw.js                   # Service worker: caching, offline shell, version patching
├── version.js              # APP_VERSION constant + Supabase key storage helpers
├── utils/
│   ├── datetime.js           # Pure datetime utilities (localIso, fmt, dv* helpers)
│   ├── supabase-helpers.js   # Supabase error handling (missingColumn, isNetworkError, wait)
│   ├── validation.js         # Input validation (supportedMealType)
│   ├── html.js               # HTML escaping (esc)
│   ├── data-mapping.js       # V2 data extraction (pick, pickArray, recordTime)
│   └── five-a-day-calculator.js  # Pure 5 A Day portion calculations
├── services/
│   ├── data-service.js      # Supabase loading/pagination, schema-fallback inserts/updates
│   ├── v2-import.js         # V2 JSON backup import + V3 export + migration dedup helpers
│   ├── five-a-day-repository.js  # 5 A Day Supabase data access (plus in-memory test adapter)
│   └── five-a-day-catalogue.js   # 5 A Day food catalogue data
├── ui/
│   ├── dayview-renderer.js  # Day view timeline rendering (fetch, build, charts)
│   ├── render.js            # List/tab rendering, timeline, glucose summary
│   ├── timing-utils.js      # Glucose timing offset calculations + meal auto-fill
│   ├── water-intake.js      # Water intake tracking: bottle viz + meal/drink integration
│   ├── form-controllers.js  # Form state, submit handlers, event wiring
│   ├── hba1c-trend.js       # HbA1c trend estimation
│   ├── insights-view.js     # Weekly/monthly insights charts
│   ├── five-a-day.js        # 5 A Day tab rendering + interactions
│   └── chartjs-config.js    # Chart.js shared config, emoji plugin, tooltip handler
├── manifest.webmanifest     # PWA install manifest
├── icon-192.png             # PWA icon (192px)
├── icon-512.png             # PWA icon (512px)
├── VERSION                  # Version string (4.14.0)
├── .env                     # Local environment (gitignored, not committed)
├── .gitignore
├── .vscode/
│   └── extensions.json      # Editor config recommendation
├── supabase/
│   ├── SCHEMA-SNAPSHOT.md   # Authoritative Supabase schema reference
│   ├── types.ts             # Generated Supabase TypeScript types
│   ├── v4-schema-snapshot.sql  # SQL for schema introspection
│   └── migrations/          # SQL migrations (water_intake, five_a_day_entries, meal_triggers)
├── tests/
│   ├── package.json         # Playwright test dependencies
│   ├── playwright.config.js # Playwright config with auto-starting web server
│   ├── smoke.test.js        # Browser smoke tests for critical flows
│   ├── server.js            # Static file server for smoke tests
│   ├── water.test.js        # E2E tests for water intake feature
│   ├── five-a-day.test.js   # E2E tests for 5 A Day feature
│   └── unit/                # Node.js built-in runner unit tests (260 tests)
├── Makefile                 # Repeatable syntax checks + dev server
├── AGENTS.md                # Agent workflow: git, release, safety rules
├── AI_CONTEXT.md            # Architecture, data rules, project checks (authoritative)
├── V3-MIGRATION.md          # V2 → V3 migration guide (historical)
├── V3.3-ROADMAP.md          # Graph visualization roadmap (historical)
├── V4-ROADMAP.md            # AI meal analysis roadmap (historical)
└── Prompt.md / REFACTORING-STEP-1.md / TRIGGER_FIELDS_PLAN.md  # Historical session notes
```

### Key architecture notes

- **Static PWA** — no build system, no package manager, no bundler. `index.html` loads modules from `utils/`, `services/`, and `ui/` via `<script>` tags, then contains the app shell (auth, data loading, event wiring) in a single inline `<script>` block.
- **Supabase backend** — Auth + PostgreSQL with RLS. The service worker (`sw.js`) patches responses from older cached app shells for version compatibility.
- **`version.js`** is the single source of truth for `APP_VERSION`. It is imported by `sw.js`, `index.html`, and `setup.html`.
- **`VERSION` file** mirrors the version string in `version.js`. Keep both aligned for releases.
- **Migration dedup helpers** (`getMigrationState`, `hasImportedFood`, `hasImportedSymptom`, `hasImportedBowel`) live in `services/v2-import.js` and are covered by `tests/unit/v2-import.test.js`.

## 5 A Day tracker

The 5 A Day tab stores entries in the user's Supabase `five_a_day_entries` table. Data access is isolated behind `services/five-a-day-repository.js`, uses the authenticated user's ID, and relies on table row-level security. The browser queries the selected local day and calculates its confirmed progress from the saved entries.

Confirmed entries use adult NHS portion guidance: 80g for most fruit and vegetables, around 30g for dried fruit, up to one combined portion (150ml) for juice and smoothies, and at most one portion total from beans and pulses. Potatoes, sweet potatoes and cassava are excluded. Mixed dishes count only an explicitly known qualifying produce weight; the app does not estimate a dish's ingredients. Unconfirmed items are not included in totals.

The source catalogue and calculator are separate from the Supabase repository. The schema migration is in `supabase/migrations/20261011_create_five_a_day_entries.sql`. The application never runs database migrations.

Portion guidance source: [NHS 5 A Day portion sizes](https://www.nhs.uk/live-well/eat-well/5-a-day/portion-sizes/).

## Development

### Required checks (run before every refactor change)

```bash
make check
```

This runs:
1. **JavaScript syntax** — `node --check version.js`, `node --check sw.js`, and all `utils/*.js`, `ui/*.js`, `services/*.js`
2. **HTML structure** — validates DOCTYPE, `<html>`, and `<body>` tags in both `index.html` and `setup.html`
3. **Git diff** — `git diff --check` for whitespace errors

### Unit tests

```bash
make test-unit
```

Unit tests use the Node.js built-in test runner (`node --test`). Test files live in `tests/unit/` and cover pure utility functions extracted into `utils/`, `services/`, and `ui/` (260 tests as of 4.14.0).

> Note: `tests/unit/water-intake.test.js` has 7 pre-existing failures caused by gaps in its mock Supabase client (the `update()` chain and cross-date dedup path are not emulated). They are unrelated to app behavior and are not a blocker for refactoring.

### Browser smoke tests

```bash
cd tests
npm install
npx playwright install  # download browsers
npm test
```


Smoke tests verify:
- App loads with correct title and version
- Auth screen is visible when not signed in
- Setup link is visible
- Service worker registers
- All 9 navigation tab buttons exist
- PWA manifest is valid JSON
- Setup page loads with key input

### Run all tests

```bash
make test  # runs unit tests + smoke tests
```

### Git workflow

- Work on `feature/*`, `fix/*`, or `refactor/*` branches
- `main` is production — never edit directly
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, etc.
- See `AGENTS.md` for the full workflow
