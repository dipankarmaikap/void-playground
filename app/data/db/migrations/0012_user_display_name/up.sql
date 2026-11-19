-- Adds the users display_name column to databases created before it existed.

ALTER TABLE users ADD COLUMN display_name TEXT;
