@AGENTS.md

# CLAUDE.md

Everything structural lives in `AGENTS.md` (imported above) — layout, commands, load order, conventions, pitfalls. Keep it there; don't duplicate it here.

Only extras for Claude Code sessions:

- Reference edits by exact path + line range (e.g. [js/script.js:120-180](js/script.js#L120-L180)).
- Map + realtime (Leaflet ↔ Supabase realtime) are the trickiest parts to touch — treat as separate tasks.
- Stay vanilla. Migrating to Vite/React/TS is only worth it if the repo grows or gains contributors; for fixes and small features, refactor in place.
