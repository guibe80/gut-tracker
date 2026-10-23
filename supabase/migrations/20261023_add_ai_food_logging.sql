-- Review-first AI food logging: optional estimate/audit fields plus an atomic,
-- idempotent save RPC. This migration does not weaken the existing ownership model.
BEGIN;

ALTER TABLE public.meals
    ADD COLUMN estimated_calories_kcal numeric,
    ADD COLUMN estimated_sugars_g numeric,
    ADD COLUMN estimated_fat_g numeric,
    ADD COLUMN ai_assumptions text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.meal_foods
    ADD COLUMN estimated_calories_kcal numeric,
    ADD COLUMN protein_estimate_g numeric,
    ADD COLUMN sugars_g numeric,
    ADD COLUMN fat_g numeric;

ALTER TABLE public.meals
    ADD CONSTRAINT meals_ai_estimates_nonnegative CHECK (
        (estimated_calories_kcal IS NULL OR estimated_calories_kcal >= 0) AND
        (estimated_sugars_g IS NULL OR estimated_sugars_g >= 0) AND
        (estimated_fat_g IS NULL OR estimated_fat_g >= 0)
    );
ALTER TABLE public.meal_foods
    ADD CONSTRAINT meal_foods_ai_estimates_nonnegative CHECK (
        (estimated_calories_kcal IS NULL OR estimated_calories_kcal >= 0) AND
        (protein_estimate_g IS NULL OR protein_estimate_g >= 0) AND
        (sugars_g IS NULL OR sugars_g >= 0) AND (fat_g IS NULL OR fat_g >= 0)
    );

CREATE TABLE public.ai_food_log_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    meal_id uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ai_food_log_submissions_user_request_unique UNIQUE (user_id, request_id)
);
ALTER TABLE public.ai_food_log_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own AI food submissions" ON public.ai_food_log_submissions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can create own AI food submissions" ON public.ai_food_log_submissions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.save_ai_food_log(
    p_request_id uuid, p_meal jsonb, p_ingredients jsonb, p_water_amounts jsonb
) RETURNS TABLE(meal_id uuid, water_entry_ids uuid[], already_saved boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_meal_id uuid;
    v_water_ids uuid[] := '{}';
    v_amount numeric;
    v_water_id uuid;
    v_item jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
    -- Serialize identical retries so a double-click or network retry returns the
    -- first write instead of racing the unique constraint.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || p_request_id::text, 0));
    SELECT s.meal_id INTO v_meal_id FROM ai_food_log_submissions s WHERE s.user_id = v_user_id AND s.request_id = p_request_id;
    IF FOUND THEN RETURN QUERY SELECT v_meal_id, v_water_ids, true; RETURN; END IF;
    INSERT INTO meals (user_id, meal_time, meal_type, notes, estimated_carbohydrate_g, protein_estimate_g, fibre_estimate_g, estimated_calories_kcal, estimated_sugars_g, estimated_fat_g, ai_assumptions)
    VALUES (v_user_id, (p_meal->>'meal_time')::timestamptz, COALESCE(p_meal->>'meal_type', 'other'), p_meal->>'notes', (p_meal->>'estimated_carbohydrate_g')::numeric, (p_meal->>'protein_estimate_g')::numeric, (p_meal->>'fibre_estimate_g')::numeric, (p_meal->>'estimated_calories_kcal')::numeric, (p_meal->>'estimated_sugars_g')::numeric, (p_meal->>'estimated_fat_g')::numeric, COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_meal->'ai_assumptions', '[]'))), '{}')) RETURNING id INTO v_meal_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_ingredients, '[]')) LOOP
        INSERT INTO meal_foods (meal_id, food_name, portion, portion_unit, estimated_carbohydrate_g, estimated_fibre_g, estimated_calories_kcal, protein_estimate_g, sugars_g, fat_g, notes)
        VALUES (v_meal_id, v_item->>'food_name', (v_item->>'portion')::numeric, v_item->>'portion_unit', (v_item->>'estimated_carbohydrate_g')::numeric, (v_item->>'estimated_fibre_g')::numeric, (v_item->>'estimated_calories_kcal')::numeric, (v_item->>'protein_estimate_g')::numeric, (v_item->>'sugars_g')::numeric, (v_item->>'fat_g')::numeric, v_item->>'notes');
    END LOOP;
    FOR v_amount IN SELECT value::text::numeric FROM jsonb_array_elements(COALESCE(p_water_amounts, '[]')) LOOP
        IF v_amount <= 0 THEN RAISE EXCEPTION 'Water amount must be positive'; END IF;
        INSERT INTO water_intake (user_id, consumed_at, amount_ml, source, meal_id) VALUES (v_user_id, (p_meal->>'meal_time')::timestamptz, v_amount, 'meal', v_meal_id) RETURNING id INTO v_water_id;
        v_water_ids := array_append(v_water_ids, v_water_id);
    END LOOP;
    INSERT INTO ai_food_log_submissions (user_id, request_id, meal_id) VALUES (v_user_id, p_request_id, v_meal_id);
    RETURN QUERY SELECT v_meal_id, v_water_ids, false;
END $$;
GRANT EXECUTE ON FUNCTION public.save_ai_food_log(uuid, jsonb, jsonb, jsonb) TO authenticated;

COMMIT;
