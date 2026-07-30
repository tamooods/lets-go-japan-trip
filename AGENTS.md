# Japan Trip Itinerary — Agent Guide

Collaborative trip planner for ~10 friends. Vanilla JS static site, no bundler. Backed by Supabase (Postgres + Realtime). npm is dev-tooling only (ESLint/Prettier) — no runtime deps. UI language is Thai (ภาษาไทย).

## Code Quality

ESLint (JS lint) + Prettier (auto-formatter) + EditorConfig.

```sh
npm run format       # Prettier — จัดรูปแบบโค้ด
npm run format:check # เช็คว่าถูก format หรือยัง
npm run lint         # ESLint — ตรวจหา bug
npm run check        # lint + format check
```

Config files: `.editorconfig`, `.prettierrc`, `.prettierignore`, `eslint.config.js`. Lint scope: `js/` + `config.example.js`.

## Local Dev

No build step. Serve files statically:

```sh
npx serve .
# or open index.html directly in a browser
```

**Required:** Copy `config.example.js` → `config.js` and fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TRIP_ITINERARY_ID`, `TRIP_DEPARTURE_DATE`, `MAPTILER_KEY`, `UNSPLASH_ACCESS_KEY`. Without it, the app silently fails (`window.SUPABASE_URL` is undefined). `config.js` is gitignored.

## Deploy

Push to Vercel. `vercel.json` runs `build-config.sh`, which writes `config.js` from env vars (`outputDirectory: "."`, no bundle step). The script hard-fails if `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `TRIP_ITINERARY_ID` are missing.

## Database

Migrations and seed are run manually in the Supabase SQL Editor (no CLI runner):

- Migrations: `supabase/migrations/` (001–009) — run in order
- Seed: `supabase/seed.sql` — requires an active Supabase session (`auth.uid()` used as owner)

## Layout

```
index.html            entry point; all modals inline
config.js             runtime config (gitignored) — from config.example.js or build-config.sh
build-config.sh       Vercel build: env vars → config.js
css/style.css         ~2700 lines: theme vars, splash, sidebar, map, modals, animations
js/                   app code (load order below)
assets/               favicon.svg, bg-lofi.mp3
supabase/             migrations/001–009 + seed.sql
docs/superpowers/specs/  design specs for shipped features
```

| File               | LoC  | Role                                                           |
| ------------------ | ---- | -------------------------------------------------------------- |
| `js/script.js`     | 996  | Core app: `DAYS` global, `renderSidebar`, `renderMap`, `goTo`  |
| `js/editor.js`     | 375  | Day edit modal + optimistic lock RPC call                      |
| `js/day-places.js` | 198  | Place CRUD via RPC (`add_day_place`, `update_day_place`, etc.) |
| `js/realtime.js`   | 100  | Supabase Realtime subscription on `days` table                 |
| `js/conflict.js`   | 57   | Conflict resolution modal (overwrite vs discard)               |
| `js/selection.js`  | 49   | Member-identity modal; persists choice in localStorage         |
| `js/db.js`         | 21   | Supabase client init + `loadDays()`, `loadMembers()`           |

**Script load order matters** (no ES modules, CDN globals — Leaflet + supabase-js from unpkg/jsdelivr):
`config.js` → `js/db.js` → `js/day-places.js` → `js/selection.js` → `js/realtime.js` → `js/editor.js` → `js/conflict.js` → `js/script.js`

## Key Conventions

- **DOM helpers:** Use `el(tag, cls, text)` and `append(parent, ...children)` — never `innerHTML` for user data (XSS prevention)
- **Global state:** `DAYS`, `map`, `markers`, `curIdx` live in `script.js`; set `window._editingDayId` in `editor.js` to suppress realtime UI updates while editing
- **Modals:** Toggle with `.classList.add/remove('hidden')` — `hidden` maps to `display:none` in CSS
- **`details` JSONB shape:** `{ place, date, jp, lat, lng, acts[], badges[], travel }`. `date` is a free-text label ("6 Dec"); old rows pack `"place_date"` into `place` — `splitPlaceDate()` ([js/script.js:47](js/script.js#L47)) falls back to splitting on `_` until re-saved through the editor.
- **Optimistic locking:** Via `update_day_if_version(p_id, p_expected_version, p_changes, p_actor text, p_actor_at text)` RPC — returns `{ ok: false, error: "conflict", current: row }` on version mismatch; handled by `conflict.js`. Migration 006 dropped the old `(uuid, int, jsonb, uuid)` variant.
- **Hard-coded itinerary ID:** `window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001'` (set in config)

## Pitfalls

- Adding a new JS file? Put it in `js/` และเพิ่มใน `index.html` ตามลำดับ load ที่ถูกต้อง
- No error boundaries — `initApp()` throws uncaught if `loadDays()` fails
- `editor.js` passes `p_actor: window.currentMember.name` (from selection.js) — relies on member flow completing before editing
