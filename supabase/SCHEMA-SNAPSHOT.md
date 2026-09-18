## TABLES

### bowel_movements
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `occurred_at` timestamp with time zone NOT NULL
- `bristol_type` smallint
- `urgency` numeric
- `completeness` numeric
- `difficulty` numeric
- `straining` boolean
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()

### daily_context
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `context_date` date NOT NULL
- `sleep_hours` numeric
- `sleep_quality` smallint
- `stress_level` smallint
- `exercise_minutes` integer
- `exercise_intensity` text
- `caffeine_mg` numeric
- `alcohol_units` numeric
- `water_litres` numeric
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()
- `updated_at` timestamp with time zone NOT NULL DEFAULT now()

### foods
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `name` text NOT NULL
- `fodmap_category` text
- `carbohydrate_per_100g` numeric
- `fibre_per_100g` numeric
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()

### glucose_readings
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `measured_at` timestamp with time zone NOT NULL
- `glucose_mmol_l` numeric NOT NULL
- `timing` text
- `meal_id` uuid
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()
- `meter_name` text
- `context` text
- `estimated_meal_carbs_g` numeric
- `meal_relationship` text
- `minutes_from_meal` integer

### gut_symptoms
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `occurred_at` timestamp with time zone NOT NULL
- `symptom_type` text NOT NULL
- `severity` smallint
- `duration_minutes` integer
- `meal_id` uuid
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()

### meal_foods
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `meal_id` uuid NOT NULL
- `food_id` uuid
- `food_name` text NOT NULL
- `portion` numeric
- `portion_unit` text
- `estimated_carbohydrate_g` numeric
- `estimated_fibre_g` numeric
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()

### meals
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `meal_time` timestamp with time zone NOT NULL
- `meal_type` text
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()
- `updated_at` timestamp with time zone NOT NULL DEFAULT now()
- `estimated_carbohydrate_g` numeric
- `protein_estimate_g` numeric
- `fibre_estimate_g` numeric

### profiles
- `id` uuid NOT NULL
- `created_at` timestamp with time zone NOT NULL DEFAULT now()
- `updated_at` timestamp with time zone NOT NULL DEFAULT now()

### weight_entries
- `id` uuid NOT NULL DEFAULT gen_random_uuid()
- `user_id` uuid NOT NULL
- `measured_at` timestamp with time zone NOT NULL DEFAULT now()
- `weight_kg` numeric NOT NULL
- `notes` text
- `created_at` timestamp with time zone NOT NULL DEFAULT now()

## PRIMARY KEYS

- `bowel_movements` → `id`
- `daily_context` → `id`
- `foods` → `id`
- `glucose_readings` → `id`
- `gut_symptoms` → `id`
- `meal_foods` → `id`
- `meals` → `id`
- `profiles` → `id`
- `weight_entries` → `id`

## FOREIGN KEYS

- `bowel_movements.user_id` → `profiles.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]
- `daily_context.user_id` → `profiles.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]
- `glucose_readings.meal_id` → `meals.id` [ON DELETE SET NULL, ON UPDATE NO ACTION]
- `glucose_readings.user_id` → `profiles.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]
- `gut_symptoms.meal_id` → `meals.id` [ON DELETE SET NULL, ON UPDATE NO ACTION]
- `gut_symptoms.user_id` → `profiles.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]
- `meal_foods.food_id` → `foods.id` [ON DELETE SET NULL, ON UPDATE NO ACTION]
- `meal_foods.meal_id` → `meals.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]
- `meals.user_id` → `profiles.id` [ON DELETE CASCADE, ON UPDATE NO ACTION]

## UNIQUE CONSTRAINTS

- `daily_context` → `user_id, context_date`
- `foods` → `name`

## CHECK CONSTRAINTS

- `bowel_movements` → ((bristol_type >= 1) AND (bristol_type <= 7))
- `bowel_movements` → occurred_at IS NOT NULL
- `bowel_movements` → user_id IS NOT NULL
- `bowel_movements` → id IS NOT NULL
- `bowel_movements` → created_at IS NOT NULL
- `bowel_movements` → ((urgency >= (0)::numeric) AND (urgency <= (10)::numeric))
- `bowel_movements` → ((completeness >= (0)::numeric) AND (completeness <= (10)::numeric))
- `bowel_movements` → ((difficulty >= (0)::numeric) AND (difficulty <= (10)::numeric))
- `daily_context` → created_at IS NOT NULL
- `daily_context` → context_date IS NOT NULL
- `daily_context` → user_id IS NOT NULL
- `daily_context` → id IS NOT NULL
- `daily_context` → ((sleep_quality >= 0) AND (sleep_quality <= 10))
- `daily_context` → ((stress_level >= 0) AND (stress_level <= 10))
- `daily_context` → (exercise_intensity = ANY (ARRAY['light'::text, 'moderate'::text, 'vigorous'::text]))
- `daily_context` → updated_at IS NOT NULL
- `foods` → id IS NOT NULL
- `foods` → name IS NOT NULL
- `foods` → created_at IS NOT NULL
- `foods` → (fodmap_category = ANY (ARRAY['low'::text, 'high'::text, 'unknown'::text]))
- `glucose_readings` → created_at IS NOT NULL
- `glucose_readings` → (context = ANY (ARRAY['normal'::text, 'exercise'::text, 'illness'::text, 'poor_sleep'::text, 'stress'::text, 'alcohol'::text, 'unusual_meal'::text, 'other'::text]))
- `glucose_readings` → (meal_relationship = ANY (ARRAY['fasting'::text, 'pre_meal'::text, 'post_meal'::text, 'unrelated'::text, 'unknown'::text]))
- `glucose_readings` → ((glucose_mmol_l >= (1)::numeric) AND (glucose_mmol_l <= (40)::numeric))
- `glucose_readings` → (timing = ANY (ARRAY['fasting'::text, 'before_meal'::text, '30_min_after'::text, '1_hour_after'::text, '2_hours_after'::text, '3_hours_after'::text, 'bedtime'::text, 'random'::text, 'other'::text]))
- `glucose_readings` → id IS NOT NULL
- `glucose_readings` → user_id IS NOT NULL
- `glucose_readings` → measured_at IS NOT NULL
- `glucose_readings` → glucose_mmol_l IS NOT NULL
- `gut_symptoms` → occurred_at IS NOT NULL
- `gut_symptoms` → user_id IS NOT NULL
- `gut_symptoms` → (symptom_type = ANY (ARRAY['bloating'::text, 'abdominal_pain'::text, 'gas'::text, 'gurgling'::text, 'urgency'::text, 'nausea'::text, 'reflux'::text, 'constipation'::text, 'diarrhoea'::text, 'other'::text]))
- `gut_symptoms` → ((severity >= 0) AND (severity <= 10))
- `gut_symptoms` → created_at IS NOT NULL
- `gut_symptoms` → symptom_type IS NOT NULL
- `gut_symptoms` → id IS NOT NULL
- `meal_foods` → id IS NOT NULL
- `meal_foods` → meal_id IS NOT NULL
- `meal_foods` → food_name IS NOT NULL
- `meal_foods` → created_at IS NOT NULL
- `meals` → updated_at IS NOT NULL
- `meals` → id IS NOT NULL
- `meals` → user_id IS NOT NULL
- `meals` → meal_time IS NOT NULL
- `meals` → created_at IS NOT NULL
- `meals` → (meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text, 'drink'::text, 'other'::text]))
- `profiles` → updated_at IS NOT NULL
- `profiles` → created_at IS NOT NULL
- `profiles` → id IS NOT NULL
- `weight_entries` → ((weight_kg > (0)::numeric) AND (weight_kg < (1000)::numeric))
- `weight_entries` → id IS NOT NULL
- `weight_entries` → user_id IS NOT NULL
- `weight_entries` → measured_at IS NOT NULL
- `weight_entries` → weight_kg IS NOT NULL
- `weight_entries` → created_at IS NOT NULL

## INDEXES

- `bowel_movements` → bowel_movements_pkey: CREATE UNIQUE INDEX bowel_movements_pkey ON public.bowel_movements USING btree (id)
- `bowel_movements` → idx_bowel_user_time: CREATE INDEX idx_bowel_user_time ON public.bowel_movements USING btree (user_id, occurred_at DESC)
- `daily_context` → daily_context_pkey: CREATE UNIQUE INDEX daily_context_pkey ON public.daily_context USING btree (id)
- `daily_context` → daily_context_user_id_context_date_key: CREATE UNIQUE INDEX daily_context_user_id_context_date_key ON public.daily_context USING btree (user_id, context_date)
- `daily_context` → idx_context_user_date: CREATE INDEX idx_context_user_date ON public.daily_context USING btree (user_id, context_date DESC)
- `foods` → foods_name_key: CREATE UNIQUE INDEX foods_name_key ON public.foods USING btree (name)
- `foods` → foods_pkey: CREATE UNIQUE INDEX foods_pkey ON public.foods USING btree (id)
- `glucose_readings` → glucose_readings_pkey: CREATE UNIQUE INDEX glucose_readings_pkey ON public.glucose_readings USING btree (id)
- `glucose_readings` → idx_glucose_meal: CREATE INDEX idx_glucose_meal ON public.glucose_readings USING btree (meal_id)
- `glucose_readings` → idx_glucose_meal_time: CREATE INDEX idx_glucose_meal_time ON public.glucose_readings USING btree (meal_id, measured_at)
- `glucose_readings` → idx_glucose_user_time: CREATE INDEX idx_glucose_user_time ON public.glucose_readings USING btree (user_id, measured_at DESC)
- `gut_symptoms` → gut_symptoms_pkey: CREATE UNIQUE INDEX gut_symptoms_pkey ON public.gut_symptoms USING btree (id)
- `gut_symptoms` → idx_symptoms_meal: CREATE INDEX idx_symptoms_meal ON public.gut_symptoms USING btree (meal_id)
- `gut_symptoms` → idx_symptoms_user_time: CREATE INDEX idx_symptoms_user_time ON public.gut_symptoms USING btree (user_id, occurred_at DESC)
- `meal_foods` → idx_meal_foods_meal: CREATE INDEX idx_meal_foods_meal ON public.meal_foods USING btree (meal_id)
- `meal_foods` → meal_foods_pkey: CREATE UNIQUE INDEX meal_foods_pkey ON public.meal_foods USING btree (id)
- `meals` → idx_meals_user_time: CREATE INDEX idx_meals_user_time ON public.meals USING btree (user_id, meal_time DESC)
- `meals` → meals_pkey: CREATE UNIQUE INDEX meals_pkey ON public.meals USING btree (id)
- `profiles` → profiles_pkey: CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)
- `weight_entries` → weight_entries_pkey: CREATE UNIQUE INDEX weight_entries_pkey ON public.weight_entries USING btree (id)
- `weight_entries` → weight_entries_user_measured_at_idx: CREATE INDEX weight_entries_user_measured_at_idx ON public.weight_entries USING btree (user_id, measured_at DESC)

## ROW LEVEL SECURITY

- `bowel_movements`: RLS ENABLED
- `daily_context`: RLS ENABLED
- `foods`: RLS ENABLED
- `glucose_readings`: RLS ENABLED
- `gut_symptoms`: RLS ENABLED
- `meal_foods`: RLS ENABLED
- `meals`: RLS ENABLED
- `profiles`: RLS ENABLED
- `weight_entries`: RLS ENABLED

## RLS POLICIES

- `bowel_movements` → **Users can delete own bowel movements**
  Command: DELETE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `bowel_movements` → **Users can insert own bowel movements**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (user_id = auth.uid())

- `bowel_movements` → **Users can update own bowel movements**
  Command: UPDATE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: (user_id = auth.uid())

- `bowel_movements` → **Users can view own bowel movements**
  Command: SELECT
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `daily_context` → **Users can delete own daily context**
  Command: DELETE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `daily_context` → **Users can insert own daily context**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (user_id = auth.uid())

- `daily_context` → **Users can update own daily context**
  Command: UPDATE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: (user_id = auth.uid())

- `daily_context` → **Users can view own daily context**
  Command: SELECT
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `foods` → **Authenticated users can view foods**
  Command: SELECT
  Roles: authenticated
  Using: true
  With check: none

- `glucose_readings` → **Users can delete own glucose**
  Command: DELETE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `glucose_readings` → **Users can insert own glucose**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (user_id = auth.uid())

- `glucose_readings` → **Users can update own glucose**
  Command: UPDATE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: (user_id = auth.uid())

- `glucose_readings` → **Users can view own glucose**
  Command: SELECT
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `gut_symptoms` → **Users can delete own symptoms**
  Command: DELETE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `gut_symptoms` → **Users can insert own symptoms**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (user_id = auth.uid())

- `gut_symptoms` → **Users can update own symptoms**
  Command: UPDATE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: (user_id = auth.uid())

- `gut_symptoms` → **Users can view own symptoms**
  Command: SELECT
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `meal_foods` → **Users can delete own meal foods**
  Command: DELETE
  Roles: authenticated
  Using: (EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_foods.meal_id) AND (meals.user_id = auth.uid()))))
  With check: none

- `meal_foods` → **Users can insert own meal foods**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_foods.meal_id) AND (meals.user_id = auth.uid()))))

- `meal_foods` → **Users can update own meal foods**
  Command: UPDATE
  Roles: authenticated
  Using: (EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_foods.meal_id) AND (meals.user_id = auth.uid()))))
  With check: none

- `meal_foods` → **Users can view own meal foods**
  Command: SELECT
  Roles: authenticated
  Using: (EXISTS ( SELECT 1
   FROM meals
  WHERE ((meals.id = meal_foods.meal_id) AND (meals.user_id = auth.uid()))))
  With check: none

- `meals` → **Users can delete own meals**
  Command: DELETE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `meals` → **Users can insert own meals**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (user_id = auth.uid())

- `meals` → **Users can update own meals**
  Command: UPDATE
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: (user_id = auth.uid())

- `meals` → **Users can view own meals**
  Command: SELECT
  Roles: authenticated
  Using: (user_id = auth.uid())
  With check: none

- `profiles` → **Users can insert own profile**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (id = auth.uid())

- `profiles` → **Users can update own profile**
  Command: UPDATE
  Roles: authenticated
  Using: (id = auth.uid())
  With check: (id = auth.uid())

- `profiles` → **Users can view own profile**
  Command: SELECT
  Roles: authenticated
  Using: (id = auth.uid())
  With check: none

- `weight_entries` → **Users can add their own weight entries**
  Command: INSERT
  Roles: authenticated
  Using: none
  With check: (( SELECT auth.uid() AS uid) = user_id)

- `weight_entries` → **Users can delete their own weight entries**
  Command: DELETE
  Roles: authenticated
  Using: (( SELECT auth.uid() AS uid) = user_id)
  With check: none

- `weight_entries` → **Users can read their own weight entries**
  Command: SELECT
  Roles: authenticated
  Using: (( SELECT auth.uid() AS uid) = user_id)
  With check: none

- `weight_entries` → **Users can update their own weight entries**
  Command: UPDATE
  Roles: authenticated
  Using: (( SELECT auth.uid() AS uid) = user_id)
  With check: (( SELECT auth.uid() AS uid) = user_id)

## VIEWS

None

## FUNCTIONS

### `public.handle_new_user`
Arguments: 
Returns: trigger
Language: plpgsql

### `public.set_updated_at`
Arguments: 
Returns: trigger
Language: plpgsql

## TRIGGERS

- `daily_context` → `daily_context_updated_at`: EXECUTE FUNCTION set_updated_at()
- `meals` → `meals_updated_at`: EXECUTE FUNCTION set_updated_at()
- `profiles` → `profiles_updated_at`: EXECUTE FUNCTION set_updated_at()

## ENUM TYPES

None

## ROLE GRANTS

- `anon` → `public.bowel_movements` : DELETE
- `anon` → `public.bowel_movements` : INSERT
- `anon` → `public.bowel_movements` : REFERENCES
- `anon` → `public.bowel_movements` : SELECT
- `anon` → `public.bowel_movements` : TRIGGER
- `anon` → `public.bowel_movements` : TRUNCATE
- `anon` → `public.bowel_movements` : UPDATE
- `authenticated` → `public.bowel_movements` : DELETE
- `authenticated` → `public.bowel_movements` : INSERT
- `authenticated` → `public.bowel_movements` : REFERENCES
- `authenticated` → `public.bowel_movements` : SELECT
- `authenticated` → `public.bowel_movements` : TRIGGER
- `authenticated` → `public.bowel_movements` : TRUNCATE
- `authenticated` → `public.bowel_movements` : UPDATE
- `anon` → `public.daily_context` : DELETE
- `anon` → `public.daily_context` : INSERT
- `anon` → `public.daily_context` : REFERENCES
- `anon` → `public.daily_context` : SELECT
- `anon` → `public.daily_context` : TRIGGER
- `anon` → `public.daily_context` : TRUNCATE
- `anon` → `public.daily_context` : UPDATE
- `authenticated` → `public.daily_context` : DELETE
- `authenticated` → `public.daily_context` : INSERT
- `authenticated` → `public.daily_context` : REFERENCES
- `authenticated` → `public.daily_context` : SELECT
- `authenticated` → `public.daily_context` : TRIGGER
- `authenticated` → `public.daily_context` : TRUNCATE
- `authenticated` → `public.daily_context` : UPDATE
- `anon` → `public.foods` : DELETE
- `anon` → `public.foods` : INSERT
- `anon` → `public.foods` : REFERENCES
- `anon` → `public.foods` : SELECT
- `anon` → `public.foods` : TRIGGER
- `anon` → `public.foods` : TRUNCATE
- `anon` → `public.foods` : UPDATE
- `authenticated` → `public.foods` : DELETE
- `authenticated` → `public.foods` : INSERT
- `authenticated` → `public.foods` : REFERENCES
- `authenticated` → `public.foods` : SELECT
- `authenticated` → `public.foods` : TRIGGER
- `authenticated` → `public.foods` : TRUNCATE
- `authenticated` → `public.foods` : UPDATE
- `anon` → `public.glucose_readings` : DELETE
- `anon` → `public.glucose_readings` : INSERT
- `anon` → `public.glucose_readings` : REFERENCES
- `anon` → `public.glucose_readings` : SELECT
- `anon` → `public.glucose_readings` : TRIGGER
- `anon` → `public.glucose_readings` : TRUNCATE
- `anon` → `public.glucose_readings` : UPDATE
- `authenticated` → `public.glucose_readings` : DELETE
- `authenticated` → `public.glucose_readings` : INSERT
- `authenticated` → `public.glucose_readings` : REFERENCES
- `authenticated` → `public.glucose_readings` : SELECT
- `authenticated` → `public.glucose_readings` : TRIGGER
- `authenticated` → `public.glucose_readings` : TRUNCATE
- `authenticated` → `public.glucose_readings` : UPDATE
- `anon` → `public.gut_symptoms` : DELETE
- `anon` → `public.gut_symptoms` : INSERT
- `anon` → `public.gut_symptoms` : REFERENCES
- `anon` → `public.gut_symptoms` : SELECT
- `anon` → `public.gut_symptoms` : TRIGGER
- `anon` → `public.gut_symptoms` : TRUNCATE
- `anon` → `public.gut_symptoms` : UPDATE
- `authenticated` → `public.gut_symptoms` : DELETE
- `authenticated` → `public.gut_symptoms` : INSERT
- `authenticated` → `public.gut_symptoms` : REFERENCES
- `authenticated` → `public.gut_symptoms` : SELECT
- `authenticated` → `public.gut_symptoms` : TRIGGER
- `authenticated` → `public.gut_symptoms` : TRUNCATE
- `authenticated` → `public.gut_symptoms` : UPDATE
- `anon` → `public.meal_foods` : DELETE
- `anon` → `public.meal_foods` : INSERT
- `anon` → `public.meal_foods` : REFERENCES
- `anon` → `public.meal_foods` : SELECT
- `anon` → `public.meal_foods` : TRIGGER
- `anon` → `public.meal_foods` : TRUNCATE
- `anon` → `public.meal_foods` : UPDATE
- `authenticated` → `public.meal_foods` : DELETE
- `authenticated` → `public.meal_foods` : INSERT
- `authenticated` → `public.meal_foods` : REFERENCES
- `authenticated` → `public.meal_foods` : SELECT
- `authenticated` → `public.meal_foods` : TRIGGER
- `authenticated` → `public.meal_foods` : TRUNCATE
- `authenticated` → `public.meal_foods` : UPDATE
- `anon` → `public.meals` : DELETE
- `anon` → `public.meals` : INSERT
- `anon` → `public.meals` : REFERENCES
- `anon` → `public.meals` : SELECT
- `anon` → `public.meals` : TRIGGER
- `anon` → `public.meals` : TRUNCATE
- `anon` → `public.meals` : UPDATE
- `authenticated` → `public.meals` : DELETE
- `authenticated` → `public.meals` : INSERT
- `authenticated` → `public.meals` : REFERENCES
- `authenticated` → `public.meals` : SELECT
- `authenticated` → `public.meals` : TRIGGER
- `authenticated` → `public.meals` : TRUNCATE
- `authenticated` → `public.meals` : UPDATE
- `anon` → `public.profiles` : DELETE
- `anon` → `public.profiles` : INSERT
- `anon` → `public.profiles` : REFERENCES
- `anon` → `public.profiles` : SELECT
- `anon` → `public.profiles` : TRIGGER
- `anon` → `public.profiles` : TRUNCATE
- `anon` → `public.profiles` : UPDATE
- `authenticated` → `public.profiles` : DELETE
- `authenticated` → `public.profiles` : INSERT
- `authenticated` → `public.profiles` : REFERENCES
- `authenticated` → `public.profiles` : SELECT
- `authenticated` → `public.profiles` : TRIGGER
- `authenticated` → `public.profiles` : TRUNCATE
- `authenticated` → `public.profiles` : UPDATE
- `authenticated` → `public.weight_entries` : DELETE
- `authenticated` → `public.weight_entries` : INSERT
- `authenticated` → `public.weight_entries` : SELECT
- `authenticated` → `public.weight_entries` : UPDATE