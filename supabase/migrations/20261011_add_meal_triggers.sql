-- ============================================================
-- Migration: Add triggers column to meals table
-- ============================================================
-- Purpose: Store IBS trigger tags per meal for analysis
-- ============================================================

BEGIN;

-- Add triggers column to meals table (array of text)
ALTER TABLE meals ADD COLUMN triggers text[] DEFAULT '{}';

-- Index for querying meals by trigger (GIN index for array containment)
CREATE INDEX idx_meals_triggers ON meals USING gin (triggers);

COMMIT;