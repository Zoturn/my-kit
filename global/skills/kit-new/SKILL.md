---
name: kit-new
description: Create a new project. Brainstorms the requirements, suggests language and tools from what the user already uses in past projects, scaffolds it in the right folder, applies the my-kit setup, then starts OpenSpec. Use when the user says "kit-new", "new project", or "create a project".
---

Create a new project for the user from the my-kit folder (`<kit>`: the path stored in `~/.my-kit/kit-root.txt`, written by `install-global.ps1`). Follow these steps in order. Do not skip step 1 or 2.

## 0. Load what the user already knows
Run `node "<kit>\scripts\index-projects.mjs"`, then read `~/.my-kit/knowledge/projects.json`
(every past project: stacks, dependencies, scripts, last commit, public or nda; `summary` counts usage per category).
Also skim the newest files in `~/.my-kit/proposals/` for problems that keep coming back.
This data is local. NDA project names may appear in chat with the user, never in any file that is committed.

## 1. Brainstorm
Invoke the `brainstorming` skill (from obra/superpowers, part of the kit pool) with the Skill tool and follow its process.
Its gate applies: no scaffolding or installing before the design is approved. Overrides for this kit:
- When the design doc is approved, do NOT invoke `superpowers:writing-plans`. Continue with step 3; OpenSpec replaces the plan (step 6).
- The project folder does not exist yet, so keep the design in the conversation and write it to
  `docs/brainstorm/YYYY-MM-DD-<topic>-design.md` after scaffolding (step 4). For an `nda` project do not commit it: add it to `.git/info/exclude`.
- Bring the data from step 0 into the conversation: the language and tools recommendation of step 2 belongs in the skill's "approaches" message.
If the skill is somehow missing, run a short built-in brainstorm instead: goal, users, must-haves, non-goals, constraints, scale, risks,
and end with a requirements summary the user approves.

## 2. Suggest language and tools (presented inside the brainstorm)
Map each requirement to a category (api, database, orm, ui, state, testing, auth, realtime, cloud, mobile) and compare with the index:
- Prefer what the user already uses, weighted by number of projects and recency. Say it plainly, for example "ORM: TypeORM, used in 3 of 14 projects, last in 2026-10".
- Flag anything the requirements need that the user has not used before: say it is new, what it costs to learn, and offer one familiar alternative.
- Avoid repeating problems found in past proposals.
- Defaults when the index has nothing: TypeScript, explicit return types, Jest + Testing Library, no Tailwind unless asked.
Present one recommended stack plus at most two alternatives, with one line of reasoning each, using ONE AskUserQuestion (recommended first).
Also settle: name (kebab-case), `public` (pet project or test task) or `nda`.

## 3. Choose the location
Read `~/.my-kit/projects.json` (if it does not exist, run `node <kit>/bin/kit-config.mjs` first: it asks for the public and NDA folders). Use a root whose `sensitivity` matches
(if several public roots match, ask which one).
Create `<root>\<name>`. If the folder exists and is not empty, stop and ask.
With several parts (frontend + backend) create a workspace folder with one subfolder per part.

## 4. Scaffold
Use the official generators, non-interactively. Check `<tool> --help` first, flags change between versions.
Typical: `npx create-next-app@latest`, `npx @nestjs/cli new`, `npm create vite@latest`.
Then `git init` (a workspace gets one repo at its root unless the parts are separate repos) and install dependencies.
Do not add libraries that were not agreed in step 2.

## 5. Apply my-kit
For each part run `node "<kit>\bin\kit-init.mjs" "<part dir>" --stacks <stacks>` (stacks must exist in `pool\stacks`).
Add `--personal` when the project is `nda`. For a workspace also run it on the workspace root with `--stacks ""`.
If a needed stack is missing from the pool, say so and offer to add `pool\stacks\<name>\rules\<name>.md`.

## 6. OpenSpec (after the brainstorm, never before)
Run OpenSpec's init in the project (`npx @fission-ai/openspec@latest init`; check `--help`, commands change).
Fill `openspec/project.md` from the brainstorm and the chosen stack (purpose, stack, conventions).
Then create the first change proposal for the first milestone, following the instructions OpenSpec generated, and validate it.
For an `nda` project ask once whether `openspec/` is committed or kept local; if local, add it to the repo's `.git/info/exclude`.

## 7. Project context
Write what a new session needs: purpose, users, stack and why, structure, commands (dev, build, test, lint), conventions.
Under 80 lines. `CLAUDE.md` for a public project, `CLAUDE.local.md` for an nda project (above the my-kit block, never inside it).
No client names or secrets in anything committed.

## 8. Verify
Run install, build or type-check, and tests if they exist. Report failures, do not hide them.
For nda projects run `git status` and confirm nothing from my-kit shows up.

## 9. Finish
Reply in 6 lines or fewer: where the project is, the stack and why, what was set up, the first OpenSpec proposal, and the next step.
Do not start building features unless the user asks.
