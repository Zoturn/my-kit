# Next.js rules

- Default to Server Components; add `"use client"` only when interactivity requires it.
- Validate all route handler / server action input on the server.
- Keep secrets out of client bundles; only `NEXT_PUBLIC_*` variables are exposed.
