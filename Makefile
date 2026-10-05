# Gut + Glucose Tracker — Makefile
# Repeatable dev checks

.PHONY: check check-js check-html check-git help serve smoke test test-unit

help:
	@echo "Available targets:"
	@echo "  make check      - Run all syntax checks (default)"
	@echo "  make check-js   - Syntax-check all JavaScript files"
	@echo "  make check-html - Basic HTML structure validation"
	@echo "  make check-git  - Check for whitespace errors in diff"
	@echo "  make serve      - Start local dev server on :8080"
	@echo "  make smoke      - Run browser smoke tests (requires Playwright)"
	@echo "  make test       - Run unit + smoke tests"
	@echo "  make test-unit  - Run unit tests (Node.js built-in runner)"

## Syntax checks — run before every refactor change
check: check-js check-html check-git
	@echo "All syntax checks passed."

check-js:
	@echo "Checking JavaScript syntax..."
	@node --check version.js
	@node --check sw.js
	@ls utils/*.js 2>/dev/null | xargs -r node --check
	@echo "JavaScript syntax OK."

check-html:
	@echo "Validating HTML structure..."
	@node -e "const fs=require('fs');['index.html','setup.html'].forEach(f=>{const html=fs.readFileSync(f,'utf8');const doctype=(html.match(/<!doctype[^>]*>/i)||[])[0];const openTag=(html.match(/<html[^>]*>/i)||[])[0];const closeTag=(html.match(/<\/html>/i)||[])[0];const bodyClose=(html.match(/<\/body>/i)||[])[0];if(!doctype)throw new Error(f+' missing DOCTYPE');if(!openTag)throw new Error(f+' missing <html> tag');if(!closeTag)throw new Error(f+' missing </html> tag');if(!bodyClose)throw new Error(f+' missing </body> tag');console.log('  '+f+': OK')});"
	@echo "HTML structure OK."

check-git:
	@echo "Checking git diff for whitespace errors..."
	@git diff --check
	@echo "Git diff clean."

## Local dev server
serve:
	@node tests/server.js

## Browser smoke tests (requires Playwright)
smoke:
	@echo "Running browser smoke tests..."
	@cd tests && npx playwright test --config=playwright.config.js

## Unit + smoke tests
test: test-unit smoke

## Unit tests using Node.js built-in test runner
test-unit:
	@echo "Running unit tests..."
	@node --test tests/unit/*.test.js
	@echo "Unit tests passed."
