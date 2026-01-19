-- Add show_checkboxes and show_progress columns to lists table
-- These control whether checkboxes and progress are visible on the public page
ALTER TABLE lists ADD COLUMN show_checkboxes BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE lists ADD COLUMN show_progress BOOLEAN NOT NULL DEFAULT 1;
