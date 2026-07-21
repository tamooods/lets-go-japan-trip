# Japan Trip Itinerary — Agent Guide

Collaborative trip planner for ~10 friends. Vanilla JS static site, no bundler, no npm. Backed by Supabase (Postgres + Realtime + Auth). UI language is Thai (ภาษาไทย).

## Code Quality

ESLint (JS lint) + Prettier (auto-formatter) + EditorConfig.

```sh
npm run format       # Prettier — จัดรูปแบบโค้ด
npm run format:check # เช็คว่าถูก format หรือยัง
npm run lint         # ESLint — ตรวจหา bug
npm run check        # lint + format check
```

Config files: `.editorconfig`, `.prettierrc`, `eslint.config.js`

## Local Dev

No build step. Serve files statically:

```sh
npx serve .
# or open index.html directly in a browser
```

**Required:** Copy `config.example.js` → `config.js` and fill in Supabase credentials + MAPTILER_KEY + UNSPLASH_ACCESS_KEY. Without it, the app silently fails (`window.SUPABASE_URL` is undefined). `config.js` is gitignored.

## Deploy

Push to Vercel. `vercel.json` injects env vars as `config.js` at build time — no manual step needed.

## Database

Migrations and seed are run manually in the Supabase SQL Editor (no CLI runner):

- Migrations: `supabase/migrations/` (001–008) — run in order
- Seed: `supabase/seed.sql` — requires an active Supabase session (`auth.uid()` used as owner)

## Architecture

| File            | Role                                                                |
| --------------- | ------------------------------------------------------------------- |
| `index.html`    | Single entry point; all modals inline                               |
| `css/style.css` | ~2700 lines: theme vars, splash, sidebar, map, modals, animations   |
| `script.js`     | Core app: `DAYS` global, `renderSidebar`, `renderMap`, `goTo`       |
| `db.js`         | Supabase client init + `loadDays()`, `loadMembers()`                |
| `day-places.js` | Place CRUD via RPC (`add_day_place`, `update_day_place`, etc.)      |
| `selection.js`  | Member-identity modal; persists choice in localStorage              |
| `realtime.js`   | Supabase Realtime subscription on `days` table                      |
| `editor.js`     | Day edit modal + optimistic lock RPC call                           |
| `conflict.js`   | Conflict resolution modal (overwrite vs discard)                    |
| `auth.js`       | Magic-link auth via `initAuth()` — **ยังไม่ได้ load ใน production** |

**Script load order matters** (no ES modules, CDN globals):
`config.js` → `db.js` → `day-places.js` → `selection.js` → `realtime.js` → `editor.js` → `conflict.js` → `script.js`

## Key Conventions

- **DOM helpers:** Use `el(tag, cls, text)` and `append(parent, ...children)` — never `innerHTML` for user data (XSS prevention)
- **Global state:** `DAYS`, `map`, `markers`, `curIdx` live in `script.js`; set `window._editingDayId` in `editor.js` to suppress realtime UI updates while editing
- **Modals:** Toggle with `.classList.add/remove('hidden')` — `hidden` maps to `display:none` in CSS
- **`details` JSONB shape:** `{ place, jp, lat, lng, acts[], badges[], travel }`
- **Optimistic locking:** Via `update_day_if_version(p_id, p_expected_version, p_changes, p_actor text, p_actor_at text)` RPC — returns `{ ok: false, error: "conflict", current: row }` on version mismatch; handled by `conflict.js`. Migration 006 dropped the old `(uuid, int, jsonb, uuid)` variant.
- **Hard-coded itinerary ID:** `window.TRIP_ITINERARY_ID = 'b8f5e2a1-0000-4000-8000-000000000001'` (set in config)

## Pitfalls

- Adding a new JS file? Add it to `index.html` in the correct load order position
- `auth.js` มีไฟล์แต่ **ไม่ได้ load ใน `index.html`** — ต้องเพิ่ม script tag ก่อน `db.js` ถ้าจะเปิดใช้ auth
- No error boundaries — `initApp()` throws uncaught if `loadDays()` fails
- `editor.js` passes `p_actor: window.currentMember.name` (from selection.js) — relies on member flow completing before editing
