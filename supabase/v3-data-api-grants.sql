-- V3 Data API grants
-- Run once in Supabase SQL Editor after the V3 schema.
-- RLS policies remain the security boundary.

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.foods to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.meal_foods to authenticated;
grant select, insert, update, delete on public.glucose_readings to authenticated;
grant select, insert, update, delete on public.gut_symptoms to authenticated;
grant select, insert, update, delete on public.bowel_movements to authenticated;
grant select, insert, update, delete on public.daily_context to authenticated;

-- Sequence privileges are not required for UUID primary keys.
