-- ============================================================
-- Migration: Add water_intake table
-- ============================================================
-- Purpose: Per-entry water tracking with source attribution
--          (manual +250ml vs meal/drink auto-entry)
--
-- Phase 2 of the water intake feature.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Table: water_intake
-- ------------------------------------------------------------
-- Follows existing table conventions:
--   - UUID PK with gen_random_uuid() (like meals, weight_entries, etc.)
--   - user_id FK to profiles(id), ON DELETE CASCADE (like all user tables)
--   - consumed_at timestamp (like meal_time, occurred_at, measured_at)
--   - amount_ml as numeric (like water_litres, weight_kg)
--   - source as text with CHECK constraint (like meal_type)
--   - meal_id FK to meals(id), ON DELETE SET NULL (like glucose_readings, gut_symptoms)
--   - created_at with now() default (standard across all tables)
-- ------------------------------------------------------------

CREATE TABLE water_intake (
    id          uuid              NOT NULL DEFAULT gen_random_uuid(),
    user_id     uuid              NOT NULL,
    consumed_at timestamp with time zone NOT NULL,
    amount_ml   numeric           NOT NULL,
    source      text              NOT NULL,
    meal_id     uuid,
    created_at  timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT water_intake_pkey
        PRIMARY KEY (id),

    CONSTRAINT water_intake_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT water_intake_meal_id_fkey
        FOREIGN KEY (meal_id) REFERENCES meals(id)
        ON DELETE SET NULL,

    -- Amount must be positive
    CONSTRAINT water_intake_amount_positive
        CHECK (amount_ml > 0),

    -- Only allow these source values (matches app logic)
    CONSTRAINT water_intake_source_valid
        CHECK (source IN ('manual', 'meal'))
);

-- ------------------------------------------------------------
-- Indexes (following existing naming conventions)
-- ------------------------------------------------------------

-- Primary lookup: user's water entries by date (for daily totals, lists)
CREATE INDEX idx_water_user_time
    ON water_intake USING btree (user_id, consumed_at DESC);

-- Foreign key lookup: find water entries linked to a meal
CREATE INDEX idx_water_meal
    ON water_intake USING btree (meal_id);

-- ------------------------------------------------------------
-- Row Level Security (standard pattern: each user sees only their data)
-- ------------------------------------------------------------

ALTER TABLE water_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water entries"
    ON water_intake
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own water entries"
    ON water_intake
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own water entries"
    ON water_intake
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own water entries"
    ON water_intake
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- Grants (matching all existing tables)
-- ------------------------------------------------------------

GRANT ALL ON TABLE water_intake TO anon;
GRANT ALL ON TABLE water_intake TO authenticated;

COMMIT;

-- ============================================================
-- USAGE EXAMPLES
-- ============================================================
--
-- Manual entry (+250 ml):
--   INSERT INTO water_intake (user_id, consumed_at, amount_ml, source)
--   VALUES ('<user-uuid>', now(), 250, 'manual');
--
-- Meal-integration entry (from a drink with 500ml water):
--   INSERT INTO water_intake (user_id, consumed_at, amount_ml, source, meal_id)
--   VALUES ('<user-uuid>', '<meal-time>', 500, 'meal', '<meal-uuid>');
--
-- Daily total (in ml):
--   SELECT SUM(amount_ml) FROM water_intake
--   WHERE user_id = auth.uid()
--     AND consumed_at::date = CURRENT_DATE;
--
-- All entries for a day (with source + meal link):
--   SELECT id, amount_ml, source, meal_id, consumed_at
--   FROM water_intake
--   WHERE user_id = auth.uid()
--     AND consumed_at::date = CURRENT_DATE
--   ORDER BY consumed_at DESC;
--
-- Update a meal's water entry when the meal is edited:
--   UPDATE water_intake SET amount_ml = 300
--   WHERE meal_id = '<meal-uuid>' AND source = 'meal';
--
-- Remove water entries when a meal is deleted:
--   DELETE FROM water_intake WHERE meal_id = '<meal-uuid>';
-- ============================================================
