# Plan: Add IBS Trigger Fields to Database and Frontend

## Current State
- Frontend has 10 trigger checkboxes in the food form (lines 113-126 in index.html)
- Triggers are currently saved to `meal_foods.notes` as a string: `"Triggers: FODMAPs – fruit, Caffeine, High fat"`
- On edit, triggers are read from `mealFoods[0].notes` and checkboxes are checked if value is in the string (form-controllers.js:89)
- No dedicated database column exists for triggers

## Trigger Values (from index.html)
1. FODMAPs – fruit
2. FODMAPs – dairy/lactose
3. FODMAPs – wheat/fructans
4. FODMAPs – onion/garlic
5. FODMAPs – beans/lentils (GOS)
6. FODMAPs – polyols
7. FODMAPs – sweeteners
8. Caffeine
9. High fat
10. Large portion

## Implementation Plan

### 1. Database Migration
Create new migration: `supabase/migrations/20261011_add_meal_triggers.sql`

```sql
BEGIN;

-- Add triggers column to meals table (array of text)
ALTER TABLE meals ADD COLUMN triggers text[] DEFAULT '{}';

-- Index for querying meals by trigger
CREATE INDEX idx_meals_triggers ON meals USING gin (triggers);

COMMIT;
```

Alternative: Add to `meal_foods` table instead, but `meals` is better since triggers apply to the whole meal.

### 2. Update Form Submit Handler (form-controllers.js:301-345)
- Extract triggers from checkboxes (already done at line 316)
- Include `triggers` in the meal payload sent to `save('meals', ...)`
- Remove triggers from `meal_foods.notes` (keep only food names)

### 3. Update Edit Form Population (form-controllers.js:78-89)
- Read triggers from `record.triggers` (array) instead of `mealFoods[0].notes`
- Check checkboxes based on array membership

### 4. Update Data Service (if needed)
- The `insertWithSchemaFallback` and `updateWithSchemaFallback` already handle unknown columns gracefully (they strip unknown columns and retry)
- No changes needed to data-service.js

### 5. Update Render/Display (optional)
- Display triggers in meal list entries (render.js:55-58)
- Display triggers in timeline (render.js:44)
- Display triggers in day view (ui/dayview-renderer.js)

### 6. Update V2 Import (services/v2-import.js)
- Map any existing trigger data from V2 backups to new column

### 7. Testing
- Run `make check` (syntax + HTML structure + git diff)
- Run `make smoke` (Playwright browser tests)
- Test: Create meal with triggers → save → edit → verify triggers persist
- Test: Query meals by trigger (via Supabase dashboard)

## Files to Modify
1. `supabase/migrations/20261011_add_meal_triggers.sql` (new)
2. `ui/form-controllers.js` (submit handler + edit population)
3. `ui/render.js` (optional - display triggers in lists)
4. `ui/dayview-renderer.js` (optional - display in day view)
5. `services/v2-import.js` (optional - import compatibility)

## Rollback Plan
- Migration can be reverted with `ALTER TABLE meals DROP COLUMN triggers;`
- Frontend changes are backward compatible (schema-fallback will strip unknown column)