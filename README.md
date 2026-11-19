# my-kit

Your reusable pool of Claude Code rules, agents, skills and hooks, plus a tool that sets up any project from it.

# my-kit

A reusable pool of [Claude Code](https://claude.com/claude-code) rules, agents, skills and hooks, plus tools that
set up every project from it and a daily local review of what Claude changed.

- **Set up any project** with common rules, hooks, skills and agents plus stack-specific rules (TypeScript, React, Next.js, NestJS, Postgres).
- **NDA-safe:** work projects get a *personal mode* (files hidden from git, nothing committed).
- **Gates on Claude's work:** docs check on commit, no "made with Claude" attribution, spec-gate skill, brainstorming before specs.
- **Daily review:** a scheduled local run reviews the day's LLM edits, proposes improvements per project and shows a summary page and notification.
- **New projects from a description:** `/kit-new` brainstorms, suggests a stack from your past projects, scaffolds and starts OpenSpec.

> **Platform:** the setup scripts (`kit-init`, hooks, daily review) are plain Node.js and work anywhere. The scheduler
> (`install-task.ps1`), the skill linking (`install-global.ps1`) and the toast notification are **Windows-only** for now;
> on macOS/Linux run `node scripts/daily-review.mjs` from cron/launchd. Ports are welcome (see CONTRIBUTING.md).
>
> **Read before installing:** the hooks run on your machine. `no-attribution` and `docs-check` can **block** `git commit` / `gh pr`
> commands, and the daily review runs `claude -p` (read-only tools) over your diffs. Read `pool/common/hooks/` first.
> `<kit>` below means the folder where you cloned this repo.

## Quick start

```bash
git clone <this repo> <kit> && cd <kit>
node bin/kit-config.mjs                 # asks for your PUBLIC and NDA project folders -> ~/.my-kit/projects.json (outside the repo)
node bin/kit-init-all.mjs               # dry run: shows what would be set up in every project
node bin/kit-init-all.mjs --apply       # applies it
```

Windows extras: `powershell -ExecutionPolicy Bypass -File <kit>\install-global.ps1` (global `/kit-setup`, `/kit-new`, `spec-gate`)
and `powershell -ExecutionPolicy Bypass -File <kit>\scripts\install-task.ps1 -Time 19:00` (daily review).

## Use one project

```bash
node bin/kit-init.mjs ~/projects/my-app --stacks typescript,react,nextjs
```

This writes into the project: `.claude/rules`, `.claude/agents`, `.claude/skills`, `.claude/hooks`,
`.claude/settings.json` (hooks) and a managed block in `CLAUDE.md` (between the `my-kit` markers).
Re-running is safe; locally edited files are skipped unless you pass `--force`.

Stacks available: see `pool/stacks/`. Add one by creating `pool/stacks/<name>/rules/*.md`.

## Capture hook

`pool/common/hooks/log-edit.mjs` logs every LLM file edit (time, session, tool, file path, no contents)
to `~/.my-kit/logs/<project>/<date>.jsonl`. The daily reviewer (next phase) reads these logs.

## Roadmap

1. Pool + init + capture hook (this)
2. Daily local reviewer: `claude -p` over the day's LLM diffs, writes a digest
3. Pattern scout: proposes new rules/skills/agents as PRs to this repo

## Daily reviewer (Windows)

`scripts/daily-review.mjs` reads the day's logged LLM edits, collects the git diffs for those files, runs
`claude -p` read-only against them with your project rules, and writes `~/.my-kit/digests/<date>.md`.

Register it once (daily at 19:00 by default, runs on next wake if the PC was off):

```powershell
powershell -ExecutionPolicy Bypass -File <kit>\scripts\install-task.ps1 -Time 19:00
```

Global skill: run `install-global.ps1` once to get `/kit-setup` in every project.

### Project improvement proposals

Besides reviewing the day's changes, the reviewer proposes improvements for each project it touched
(architecture, tests, duplication, security, performance, dependencies), up to 5 per project per day,
with evidence, effort and impact. Earlier proposals are passed back in, so it doesn't repeat itself.
Saved to `~/.my-kit/proposals/<project>/<date>.md` (local only, never in this repo, because projects are under NDA).
Set `KIT_PROPOSALS=0` to turn this off. Claude runs read-only; it never edits your code.

## Public vs NDA projects

`~/.my-kit/projects.json` lists your project roots and whether each is `public` or `nda` (unknown = `nda`).
The digest and proposal files are tagged `[public]` / `[NDA]`. Rule for anything that goes into this repo:
lessons from NDA projects must be abstract (no client names, code, file paths or domain details);
lessons from public projects may reference code.

Set up all projects under those roots in one go (dry run first):

```powershell
node <kit>\bin\kit-init-all.mjs          # shows what it would do
node <kit>\bin\kit-init-all.mjs --apply  # writes .claude/ and CLAUDE.md into each project
```

### Personal mode (used automatically for NDA projects)

`kit-init --personal` never edits tracked files: the rule imports go to `CLAUDE.local.md`, the hook to
`.claude/settings.local.json`, and every file the kit adds is listed in the repo's `.git/info/exclude`
(local to your clone, not shared). `kit-init-all` uses it for every root that is not `public`.

## New projects: /kit-new

`/kit-new <description>` runs this flow: brainstorm the requirements (the `brainstorming` skill if installed, otherwise a short built-in one),
suggest language and tools from your past projects, pick the folder by sensitivity (the roots in `~/.my-kit/projects.json`),
scaffold with the official generators, apply the kit (`--personal` for NDA), start OpenSpec (init, project.md, first proposal),
write the project context into `CLAUDE.md` (public) or `CLAUDE.local.md` (NDA), and verify the build.
Run `install-global.ps1` once to link both skills.

### Knowledge index

`scripts/index-projects.mjs` writes `~/.my-kit/knowledge/projects.json`: every project under your roots with its stacks,
dependencies, scripts and last commit, plus usage counts per category (api, orm, testing, ui, ...).
It is refreshed by the daily review and by `/kit-new`. It contains NDA project names, so it stays local and is never part of this repo.

## Troubleshooting the daily review

- **File missing:** the scheduled task didn't run or failed. Run it now with `Start-ScheduledTask -TaskName "my-kit daily review"` and check again after a minute.
  If it's still missing, run `schtasks /Query /TN "my-kit daily review" /V /FO LIST` and paste the "Last Result" line.
- **File says "No LLM edits logged":** the task worked, but Claude Code made no edits in the set-up projects today.
  This is expected right after setup. The "check all commits" feature (planned) closes this gap.

## Spec gate and skills in every project

- **Rule + skill:** `pool/common/rules/spec-gate.md` tells Claude to use the `spec-gate` skill before any task that changes code.
  `pool/common/skills/spec-gate` decides: spec needed (behavior, rules, contracts, data model, security, architecture)
  or no logical change (typo, rename, behavior-neutral refactor, tests, styling). Spec path: OpenSpec proposal, wait for approval. No-spec path: go straight to code.
- **Global:** `install-global.ps1` also links `pool/common/skills/*`, so `spec-gate` is available in every Claude Code session.
- **Skills and agents in each project:** `kit-init` copies the pool's skills and agents, plus everything listed in `config/skills.json`
  (default: all of `~/.claude/skills` and `~/.claude/agents`, except `kit-setup` and `kit-new`) into the project's `.claude/`.
  Plugin skills live elsewhere: add their folder to `skillSources` in `config/skills.json`.
  Re-run `kit-init-all --apply` to refresh existing projects (add `--force` in `kit-init` to overwrite locally edited copies).

## Brainstorming (from obra/superpowers)

`pool/common/skills/brainstorming` is an unmodified copy of the `brainstorming` skill from https://github.com/obra/superpowers (MIT, see its UPSTREAM.md).
Every project gets it via `kit-init`, and `install-global.ps1` links it globally. Kit-specific behavior lives in `pool/common/rules/brainstorming.md`:
no `writing-plans` (OpenSpec replaces it), design docs go to `docs/brainstorm/` and are not committed in NDA projects.
The visual companion page loads a logo from primeradiant.com unless telemetry is off, so the kit sets `SUPERPOWERS_DISABLE_TELEMETRY=1` in each project's settings.

## Docs check on Claude's commits

Hooks `PreToolUse` and `PostToolUse` on `Bash` run `pool/common/hooks/docs-check.mjs` for every `git commit` that Claude runs:
- **Before the commit:** if the commit contains code (not only docs, specs, images, lockfiles), it is blocked once. Claude is told which of
  `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/`, `openspec/` exist (and the active OpenSpec changes) and must check whether they, or code comments, need updates,
  stage the updates, then run `docs-ack.mjs "<one line>"` and commit again. The note must be at least 8 characters; it is also logged to `~/.my-kit/logs/<project>/docs-checks.jsonl`.
- **After the commit:** the note is attached to the commit as a local git note (`git log --show-notes=kit-docs`). Notes are not pushed unless you push `refs/notes/kit-docs`.
- A note stays valid for 15 minutes. `KIT_DOCS_CHECK=0` turns the check off. The hook never blocks because of its own errors.
- It is part of the manifest, so `kit-init` adds it to new projects and `kit-init-all --apply` adds it to existing ones. Re-running is safe: a hook that is already there is not added twice.

## Summary and notification

After each daily run, `scripts/summary.mjs` writes `~/.my-kit/latest.html` (open it in a browser) and sends a Windows notification
("my-kit: 3 project(s) reviewed, 1 high, 2 medium, 0 low issues, 4 proposals") that opens the page when clicked. No notification on days with nothing reviewed.
- The page shows today's totals, a table per project (high/medium/low issues, proposals, status; worst first), the full review text per project (collapsed),
  skipped projects, the last 7 days, and the docs-check notes from Claude's commits.
- The review asks Claude to end with `SEVERITY: high=.. medium=.. low=..` and `PROPOSALS: ..`. If a run omits them, the counts show `?`.
- Data per day: `~/.my-kit/digests/<date>.json` (used by the page) and `<date>.md` (readable). All local: NDA project names are in them.
- Test the toast: `node <kit>\scripts\notify.mjs --test`. Rebuild the page without a review: `node <kit>\scripts\summary.mjs`.

## Commit review and simplify

The kit has **no commit review gate of its own**: your own commit-blocking review agent does that, and a second one would review and block every commit twice.
(`kit-init` still copies your global `code-reviewer`, `codereview` and `simplify` into each project; the kit's `code-reviewer` is only a fallback.)

- **`simplify` skill** (`pool/common/skills/simplify`): reviews the changed code for reuse, quality and efficiency and fixes it without changing behavior.
  The bundled `/simplify` was removed from Claude Code (v2.1.146), so the kit carries its own. The workflow rule asks Claude to run it before committing; that part is a rule, not enforced by a hook.

## No Claude attribution

Three layers, because the setting alone is not always honored by the model:
1. `settings`: `attribution: { commit: "", pr: "", sessionUrl: false }` (merged into each project's settings by `kit-init`).
2. Rule `pool/common/rules/no-attribution.md`.
3. Hook `no-attribution.mjs` (PreToolUse on `Bash`): blocks `git commit`, `gh pr create/edit/comment/review`, `gh issue ...` and `gh api` commands whose text
   (or message file passed with `-F` / `--body-file`) contains Co-Authored-By: Claude, "Generated with Claude Code", claude.ai/code links or Claude-Session lines. `KIT_ATTRIBUTION=allow` turns it off.

## Model advice

`pool/common/rules/model-advice.md` asks Claude to say, in one line and only when it matters, if a cheaper or stronger model fits the task better. If you keep the same rule in your global `~/.claude/CLAUDE.md`, remove one of the two so it is not loaded twice.

## Precedence of your own skills and agents

If a skill or agent with the same name exists in your global `~/.claude/skills` or `~/.claude/agents`, `kit-init` copies yours and skips the kit's default of that name
(for example your own `simplify` or `code-reviewer`). The kit's version is only a fallback.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). MIT licensed ([LICENSE](LICENSE)); the bundled `brainstorming` skill is from
[obra/superpowers](https://github.com/obra/superpowers) (MIT, see its `LICENSE-superpowers`).
