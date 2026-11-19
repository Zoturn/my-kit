# Contributing to my-kit

Thanks for helping. Ideas that fit well:

- **Stacks:** add `pool/stacks/<name>/rules/*.md` (and, if needed, detection in `lib/projects.mjs`).
- **Rules, skills, agents, hooks** that are useful in *any* project (`pool/common/`).
- **Other platforms:** macOS/Linux scheduler and notification (cron/launchd, `notify-send`), to replace the Windows-only scripts.
- **Bug fixes** in `kit-init`, the hooks and the daily review.

## Ground rules

- **No private data.** Never commit real project names, client details, paths, tokens or logs. Rules must be generic.
  Lessons taken from private projects must be abstract.
- **Hooks fail safe.** A hook must never block work because of its own error (fail open) and must be easy to turn off with an env var.
- **Keep it dependency-free:** plain Node.js (ESM), no npm packages.
- **No attribution lines** in your commits are required either way; keep messages short and in the imperative ("Add X").
- Keep the upstream `brainstorming` skill unmodified; project overrides go in `pool/common/rules/brainstorming.md`.
- Update `README.md` when behavior changes.

## Try your change

```bash
node --check bin/*.mjs lib/*.mjs scripts/*.mjs pool/common/hooks/*.mjs
node bin/kit-init.mjs /tmp/test-project --stacks typescript      # in a throwaway git repo
```

Open an issue first for larger changes (new hook, new config format). Pull requests: one topic per PR, describe what you ran to check it.

## License

By contributing you agree your work is released under the MIT license of this repo.
