-- Add rejection_reason column to applications table
ALTER TABLE applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
