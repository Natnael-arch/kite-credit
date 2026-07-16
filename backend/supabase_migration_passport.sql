-- Migration to add passport_verified and passport_id columns
ALTER TABLE agents ADD COLUMN IF NOT EXISTS passport_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS passport_id TEXT;
