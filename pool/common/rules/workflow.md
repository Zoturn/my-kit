# Workflow rules

- Read existing code and reuse existing components/utilities before writing new ones.
- Keep changes scoped to what was asked. Do not refactor unrelated code.
- Run lint, type-check and tests after changes; report failures instead of hiding them.
- Never invent APIs, packages or config keys. If unsure, check the docs or the code.
- All work must be reviewed by the developer before it reaches the dev branch.
- Do not commit secrets, client names or NDA-covered code into shared repos or the kit pool.
- Commits made by Claude go through the docs check hook: review specs, docs, CLAUDE.md, AGENTS.md and comments as it asks, then record the note with `docs-ack.mjs`.
- Before committing code changes, run the `simplify` skill on your changes (once per task).
- Commit order: run `simplify` first, then stage the files that belong to this task (check `git status`; never blindly `git add -A` over unrelated changes or untracked secrets), then commit.
