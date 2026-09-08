# Gut Tracker V2 → V3 migration

V3 stores data in Supabase PostgreSQL and uses Supabase Auth + Row Level Security.

## Current migration path

1. Keep the V2 app/data untouched.
2. Open the V3 app and sign in/create your Supabase Auth user.
3. Open **Data → Import V2 JSON**.
4. Select the existing `gut-tracker-backup.json` exported by V2.
5. V3 imports:
   - V2 food entries → `meals` + `meal_foods`
   - V2 symptom observations → `gut_symptoms`
   - V2 stool observations → `bowel_movements`
6. Each imported record receives a `[V2 migration ...]` marker in its notes so the same backup can be safely retried without intentionally duplicating marked records.
7. The Data screen reports the imported counts.

## Data fidelity

The original V2 food text is preserved as one `meal_foods.food_name` value because V2 stored free-text meals rather than a structured food-item list. Original trigger labels are preserved in the `meal_foods.notes` field.

V2 symptom records contain four separate severity fields (bloating, pain, gas and urgency). V3 represents these as separate `gut_symptoms` rows so they can be analysed independently.

If a V2 symptom record has a Bristol stool value, V3 also creates a `bowel_movements` row.

## Important

The migration is client-side and uses the authenticated user's Supabase session. It does **not** require or expose a Supabase service/secret key.

After migration, verify row counts in Supabase before deleting or changing your V2 local data.
