# Development Workflow

## Git

- `main` is the production branch.
- Never make changes directly on `main`.
- New functionality must use `feature/<name>`.
- Bug fixes must use `fix/<name>`.
- Refactoring must use `refactor/<name>`.
- Changes should be merged into `main` through a Pull Request.
- Do not delete branches unless explicitly requested.

## Versioning

Use Semantic Versioning: MAJOR.MINOR.PATCH.

- New backwards-compatible functionality → increment MINOR.
- Bug fix → increment PATCH.
- Breaking change → increment MAJOR.

When completing a feature:
1. Determine the appropriate version increment.
2. Update the application's version.
3. Update the changelog if applicable.
4. Run the project's tests and build.
5. Report the version change in the final response.

Never change the version merely because a file was edited.
Only increment the version when a feature, bug fix or release requires it.

## Before committing

- Check `git status`.
- Review the changes.
- Run the relevant tests.
- Run the production build where applicable.
- Do not commit secrets, credentials or `.env` files.

## Commits

Use concise conventional commit messages:

feat: add dashboard
fix: correct authentication redirect
refactor: simplify API client
docs: update installation instructions