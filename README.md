# Gut + Glucose Tracker

A privacy-first, installable PWA for tracking meals, blood glucose, gut symptoms,
bowel movements, and weight — backed by Supabase PostgreSQL with Row Level Security.

## What it does

- Record meals with carbs, protein, fibre, FODMAP triggers, and notes
- Log spot glucose readings (mmol/L) with timing context
- Track gut symptoms and bowel movements (Bristol type)
- Record weight entries
- Track daily water intake with an interactive visualised bottle
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
├── index.html              # Main app: UI, styles, app logic (single-file PWA)
├── setup.html              # First-run page: stores Supabase publishable key
├── sw.js                   # Service worker: caching, offline shell, version patching
├── version.js              # APP_VERSION constant + Supabase key storage helpers
├── utils/
│   ├── datetime.js           # Pure datetime utilities (localIso, fmt, dv* helpers)
│   ├── supabase-helpers.js   # Supabase error handling (missingColumn, isNetworkError, wait)
│   ├── validation.js         # Input validation (supportedMealType)
│   ├── html.js               # HTML escaping (esc)
│   └── data-mapping.js       # V2 data extraction (pick, pickArray, recordTime)
├── manifest.webmanifest    # PWA install manifest
├── icon-192.png            # PWA icon (192px)
├── icon-512.png            # PWA icon (512px)
├── VERSION                 # Version string (3.5.0)
├── services/
│   ├── data-service.js     # Supabase data loading/pagination
│   └── v2-import.js        # V2 JSON backup import
├── ui/
│   ├── dayview-renderer.js # Day view timeline rendering
│   ├── render.js           # List/tab rendering + data loading (v3)
│   ├── timing-utils.js     # Glucose timing offset calculations + meal auto-fill
│   ├── water-intake.js     # Water intake tracking: bottle viz + meal/drink integration
│   ├── form-controllers.js # Form state, submit handlers, event wiring
│   └── hba1c-trend.js     # HbA1c trend estimation (timing-weighted)
├── .env                    # Local environment (gitignored, not committed)
├── .gitignore
├── .vscode/
│   └── extensions.json     # Editor config recommendation
├── supabase/
│   ├── SCHEMA-SNAPSHOT.md  # Authoritative Supabase schema reference
│   ├── types.ts            # Generated Supabase TypeScript types
│   └── v4-schema-snapshot.sql  # SQL for schema introspection
├── tests/
│   ├── package.json        # Playwright test dependencies
│   ├── playwright.config.js  # Playwright config with auto-starting web server
│   ├── smoke.test.js       # Browser smoke tests for critical flows
│   ├── server.js           # Static file server for smoke tests
│   └── unit/
│       ├── datetime.test.js         # Unit tests for datetime utilities
│       ├── html.test.js             # Unit tests for HTML escaping
│       ├── supabase-helpers.test.js # Unit tests for Supabase helpers
│       ├── validation.test.js       # Unit tests for validation helpers
│       ├── data-mapping.test.js     # Unit tests for V2 data mapping
│       └── timing-utils.test.js     # Unit tests for timing/offset logic
│       └── water-intake.test.js     # Unit tests for water target + drink parsing
├── Makefile                # Repeatable syntax checks + dev server
├── AGENTS.md               # Agent workflow: git, release, safety rules
├── AI_CONTEXT.md           # Architecture, data rules, project checks
├── V3-MIGRATION.md         # V2 → V3 migration guide
├── V3.3-ROADMAP.md         # Graph visualization roadmap
└── V4-ROADMAP.md           # AI meal analysis roadmap
```

### Key architecture notes

- **Static PWA** — no build system, no package manager, no bundler. `index.html` loads utility modules from `utils/` via `<script>` tags, then contains the main application logic (Supabase CRUD, UI rendering, event handlers) in a single `<script>` block.
- **Supabase backend** — Auth + PostgreSQL with RLS. The service worker (`sw.js`) patches responses from older cached app shells for version compatibility.
- **`version.js`** is the single source of truth for `APP_VERSION`. It is imported by `sw.js`, `index.html`, and `setup.html`.
- **`VERSION` file** mirrors the version string in `version.js`. Keep both aligned for releases.

## Development

### Required checks (run before every refactor change)

```bash
make check
```

This runs:
1. **JavaScript syntax** — `node --check version.js`, `node --check sw.js`, and all `utils/*.js`
2. **HTML structure** — validates DOCTYPE, `<html>`, and `<body>` tags in both `index.html` and `setup.html`
3. **Git diff** — `git diff --check` for whitespace errors

### Unit tests

```bash
make test-unit
```

Unit tests use the Node.js built-in test runner (`node --test`). Test files live in `tests/unit/` and cover pure utility functions extracted into `utils/`.

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
