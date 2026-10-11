-- PROPOSAL ONLY: review and execute manually after confirming the current
-- Supabase schema. This file is not run by the application or test suite.
-- Ownership follows the schema snapshot: user-owned tables reference profiles.id,
-- and authenticated RLS policies compare user_id with auth.uid().

CREATE TABLE IF NOT EXISTS public.five_a_day_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    consumed_at timestamp with time zone NOT NULL,
    food_name text NOT NULL CHECK (length(btrim(food_name)) BETWEEN 1 AND 120),
    category text NOT NULL CHECK (
        category IN (
            'fruit',
            'vegetable',
            'beans_pulses',
            'dried_fruit',
            'juice_smoothie',
            'mixed_dish',
            'excluded'
        )
    ),
    quantity numeric NOT NULL CHECK (quantity > 0),
    unit text NOT NULL CHECK (unit IN ('g', 'ml')),
    qualifying_weight_g numeric CHECK (qualifying_weight_g IS NULL OR qualifying_weight_g >= 0),
    source text NOT NULL DEFAULT 'catalogue' CHECK (
        source IN ('catalogue', 'manual', 'ai_suggestion')
    ),
    confirmed boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT five_a_day_juice_uses_ml CHECK (
        (category = 'juice_smoothie' AND unit = 'ml')
        OR (category <> 'juice_smoothie' AND unit = 'g')
    ),
    CONSTRAINT five_a_day_mixed_dish_known_weight CHECK (
        category <> 'mixed_dish'
        OR (
            qualifying_weight_g IS NOT NULL
            AND qualifying_weight_g <= quantity
        )
    )
);

COMMENT ON TABLE public.five_a_day_entries IS
    'Individual 5 A Day foods; contribution is calculated by the client from confirmed quantities, with daily NHS category caps.';
COMMENT ON COLUMN public.five_a_day_entries.qualifying_weight_g IS
    'For mixed dishes, only the known qualifying fruit/vegetable weight; never infer this from total dish weight.';
COMMENT ON COLUMN public.five_a_day_entries.confirmed IS
    'Unconfirmed entries are excluded from daily totals.';

CREATE INDEX IF NOT EXISTS idx_five_a_day_user_consumed_at
    ON public.five_a_day_entries (user_id, consumed_at DESC);

ALTER TABLE public.five_a_day_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own 5 A Day entries" ON public.five_a_day_entries;
CREATE POLICY "Users can view own 5 A Day entries"
    ON public.five_a_day_entries
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own 5 A Day entries" ON public.five_a_day_entries;
CREATE POLICY "Users can insert own 5 A Day entries"
    ON public.five_a_day_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own 5 A Day entries" ON public.five_a_day_entries;
CREATE POLICY "Users can update own 5 A Day entries"
    ON public.five_a_day_entries
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own 5 A Day entries" ON public.five_a_day_entries;
CREATE POLICY "Users can delete own 5 A Day entries"
    ON public.five_a_day_entries
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.five_a_day_entries TO authenticated;

DROP TRIGGER IF EXISTS five_a_day_entries_updated_at ON public.five_a_day_entries;
CREATE TRIGGER five_a_day_entries_updated_at
    BEFORE UPDATE ON public.five_a_day_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
