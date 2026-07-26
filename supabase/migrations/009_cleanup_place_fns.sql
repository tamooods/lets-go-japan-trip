-- supabase/migrations/009_cleanup_place_fns.sql
--
-- 008_add_place_img.sql used CREATE OR REPLACE with a new 8-arg signature
-- (added p_img text). Postgres treats a different argument list as a
-- different function, so the old 7-arg overload from 007 was never replaced
-- and is still callable. Drop it explicitly so only the 8-arg (with img)
-- version remains.
--
-- Note: 008 also runs `ALTER TABLE day_places ADD COLUMN img text;` without
-- IF NOT EXISTS, so it is not idempotent. That file has already been applied
-- in Supabase and must not be edited retroactively; this migration guards
-- the column add in case 008 needs to be re-run in a fresh environment.

ALTER TABLE day_places ADD COLUMN IF NOT EXISTS img text;

DROP FUNCTION IF EXISTS add_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric);
DROP FUNCTION IF EXISTS update_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric);
