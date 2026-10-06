# Refactoring Step 1 — Extract Datetime Utilities

## Status: Complete ✅

## What was done

Extracted 11 pure datetime utility functions from `index.html` into `utils/datetime.js`:

| Function | Original location | Purpose |
|---|---|---|
| `localIso(date, time)` | index.html:902 | Convert date+time inputs to ISO string |
| `ac()` | index.html:904 | Return timezone offset string (±HH:MM) |
| `stripTz(notes)` | index.html:905 | Strip `[tz:±HH:MM]` marker from notes |
| `parseTzNotes(notes)` | index.html:906 | Parse tz marker to minute offset |
| `fmt(v)` | index.html:908 | Format date to en-GB locale string |
| `localDateTime(value)` | index.html:1140 | Split datetime into {date, time} for form inputs |
| `dvParseDate(isoDate)` | index.html:920 | Parse YYYY-MM-DD → Date |
| `dvFormatDate(date)` | index.html:921 | Format Date → YYYY-MM-DD |
| `dvDayStart(isoDate)` | index.html:922 | Get start-of-day Date |
| `dvDayEnd(isoDate)` | index.html:923 | Get end-of-day Date |
| `dvPercentThrough(dayStart, eventTime)` | index.html:924 | Day-progress fraction (0–1) |
| `dvFormatHour(pct)` | index.html:925 | Format day fraction as HH:MM |

## Changes made

1. **Created `utils/datetime.js`** — Contains all 11 functions with JSDoc comments
2. **Modified `index.html`** — Added `<script src="./utils/datetime.js">` before the main script; removed the 11 function definitions from inline script
3. **Modified `sw.js`** — Added `./utils/datetime.js` to the service worker install cache list
4. **Created `tests/unit/datetime.test.js`** — 24 unit tests using Node.js built-in test runner
5. **Modified `Makefile`** — Added `test`, `test-unit` targets; added `utils/*.js` linting to `check-js`
6. **Updated `README.md`** — Updated repo map, dev workflow docs

## Verification

- `make check` — ✅ JavaScript syntax, HTML structure, git diff whitespace
- `node --test tests/unit/datetime.test.js` — ✅ 24/24 tests pass
- `make smoke` — ✅ 9/9 Playwright tests pass

## What's preserved

- All function behaviours are identical (pure function extraction, no logic changes)
- `index.html` loads `utils/datetime.js` before the main script, so functions are globally available as before
- Service worker caches the new file for offline use
- No UI changes, no schema changes, no auth changes

## Next refactoring candidates (from Phase 1 report)

Priority order:
1. **`utils/supabase-helpers.js`** — `missingColumn(error)`, `isNetworkError(error)`, `wait(ms)` — another small pure-utility extraction
2. **`utils/validation.js`** — `supportedMealType(value)` — pure validation function
3. **`utils/html.js`** — `esc(v)` — pure escaping function, used everywhere
4. **`utils/data-mapping.js`** — `pick()`, `pickArray()`, `recordTime()` — used by V2 import
