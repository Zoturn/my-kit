---
name: kit-setup
description: Set up the current project from my-kit (rules, agents, skills, hooks, CLAUDE.md). Use when starting a new project or when the user says "kit-setup", "set up my kit", or asks to apply their standard Claude Code setup.
---

Set up the current project from the my-kit pool at the my-kit folder (`<kit>`: the path stored in `~/.my-kit/kit-root.txt`, written by `install-global.ps1`).

1. Detect the stack from the project (`package.json` dependencies, `prisma/`, `docker-compose.yml`, etc.).
   Available stacks: look at the folder names in `<kit>\pool\stacks`.
2. Tell the user, in one line, which stacks you will apply (for example "typescript, react, nextjs, postgres")
   and let them correct it. If the user already named tools or languages, use those instead of detection.
3. Run: `node "<kit>\bin\kit-init.mjs" "<project dir>" --stacks <comma,separated,stacks>`
4. If the tool reports skipped files (locally edited), show them and ask before using `--force`.
5. Finish with a two-line summary: what was added, and that edits are logged to `~/.my-kit/logs/`.

If a stack the user needs does not exist in the pool, say so and offer to create `pool/stacks/<name>/rules/<name>.md`
in the my-kit repo, then run the setup again.
