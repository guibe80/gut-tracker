# Agent Workflow

`AI_CONTEXT.md` is the concise source for app architecture, data rules, and project-specific checks. Follow it alongside this workflow.

## Before editing

- Check the current branch and `git status`. Preserve all existing user changes; never discard them with reset, checkout, or cleanup commands.
- `main` is production: do not edit it directly. Use `feature/<name>`, `fix/<name>`, or `refactor/<name>`. If changing branches could affect uncommitted work, ask first.
- Find the code that owns the behavior and any nearby tests. Identify the expected behavior and the smallest useful check before editing.
- Keep changes focused. Avoid unrelated refactors, new dependencies, or build-system changes unless needed and explained.

## Implementation and safety

- Preserve existing behavior unless the request explicitly changes it. For risky changes, establish the current behavior before refactoring.
- Use synthetic data for tests. Never commit, log, or paste personal health data, credentials, publishable keys, or `.env` contents.
- Do not run destructive SQL or change a production database without explicit authorization. For approved schema changes, include a migration and update generated schema references.
- Add or update tests and documentation when behavior or workflow changes.

## Verify and report

- Run the narrowest relevant test after editing, then broader tests/build checks that apply. Use `AI_CONTEXT.md` for this project's checks.
- **Required for every change**: run `make check` (JavaScript syntax + HTML structure + git diff whitespace check) before completing the edit.
- **Required for every refactor**: run `make smoke` (browser smoke tests via Playwright) to verify critical UI flows. See `tests/smoke.test.js` for coverage details.
- Review the final diff and run `git diff --check`. Report the commands run, their results, and any checks not run; never claim unverified success.
- Summarize the behavior changed and any remaining risks. Do not commit, push, merge, or delete branches unless asked.

## Testing and merging

- **Testing gate**: Before merging any feature, fix, or refactor into `main`, the user must explicitly test and approve it. Do not merge to `main` until the user says "it works" or gives similar approval after testing.
- Development branches (`feature/`, `fix/`, `refactor/`) can be committed and pushed for the user to review, but merging into `main` requires explicit user approval after they have tested the changes.

## Versioning and release

- Use Semantic Versioning: feature → MINOR, fix → PATCH, breaking change → MAJOR.
- When a test is completed for bug fices increment MINOR version numbering, for instance 4.1.0 -> 4.1.1
- When adding new tabs, features this counts as a MAJOR change for isntacne 4.1.0 -> 4.2.0
- Update `version.js` and `VERSION` for a release, not for documentation-only or refactoring-only edits. Update a changelog if one is maintained, and report the version change.
- Merge changes into `main` through a Pull Request. Do not delete branches unless explicitly requested.


Use concise Conventional Commit messages when a commit is requested, for example `feat: add dashboard`, `fix: correct authentication redirect`, or `docs: clarify setup`.
