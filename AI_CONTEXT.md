# Gut Tracker — AI Development Context

## Project

Gut Tracker is a personal health tracking application.

## Database

Supabase PostgreSQL.

The authoritative database schema is:
`supabase/SCHEMA-SNAPSHOT.md`

The authoritative TypeScript definitions are:
`supabase/types.ts`

Do not assume database structures that aren't present in these files.

## Authentication

Supabase Auth is used.

Users are identified by:
`auth.uid()`

User-specific tables use `user_id`.

RLS must never be bypassed from the client.

## Main entities

### profiles
One profile per authenticated user.

### meals
Records meals eaten by the user.

### meal_foods
Individual foods belonging to a meal.

### foods
Shared food reference database.

### glucose_readings
Blood glucose measurements, optionally associated with a meal.

### gut_symptoms
Digestive symptoms, optionally associated with a meal.

### bowel_movements
Bowel movement records.

### daily_context
Daily lifestyle/context information.

### weight_entries
Weight measurements.

## Important development rules

1. Do not modify the database schema unless explicitly requested.
2. Do not disable RLS.
3. Do not expose service-role credentials to the client.
4. Respect existing foreign-key relationships.
5. Use the generated `Database` type for Supabase queries.
6. When changing the database, create a migration.
7. After a schema change, regenerate `types.ts`.
8. Update `SCHEMA-SNAPSHOT.md` after schema changes.