-- supabase/migrations/008_add_place_img.sql

ALTER TABLE day_places ADD COLUMN img text;

-- RPC: add a place (with img)
CREATE OR REPLACE FUNCTION add_day_place(
  p_day_id uuid,
  p_name text,
  p_acts jsonb DEFAULT '[]'::jsonb,
  p_expense numeric DEFAULT 0,
  p_split_among uuid[] DEFAULT '{}',
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_img text DEFAULT NULL
) RETURNS day_places
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sort int;
  v_row day_places;
BEGIN
  SELECT COALESCE(MAX(sort_index), 0) + 1 INTO v_sort
    FROM day_places WHERE day_id = p_day_id;

  INSERT INTO day_places (day_id, sort_index, name, acts, expense, split_among, lat, lng, img)
  VALUES (p_day_id, v_sort, p_name, p_acts, p_expense, p_split_among, p_lat, p_lng, p_img)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- RPC: update a place (with img)
CREATE OR REPLACE FUNCTION update_day_place(
  p_id uuid,
  p_name text,
  p_acts jsonb DEFAULT '[]'::jsonb,
  p_expense numeric DEFAULT 0,
  p_split_among uuid[] DEFAULT '{}',
  p_lat numeric DEFAULT NULL,
  p_lng numeric DEFAULT NULL,
  p_img text DEFAULT NULL
) RETURNS day_places
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row day_places;
BEGIN
  UPDATE day_places SET
    name = p_name,
    acts = p_acts,
    expense = p_expense,
    split_among = p_split_among,
    lat = p_lat,
    lng = p_lng,
    img = p_img
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION add_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric, text) TO anon;
GRANT EXECUTE ON FUNCTION update_day_place(uuid, text, jsonb, numeric, uuid[], numeric, numeric, text) TO anon;
