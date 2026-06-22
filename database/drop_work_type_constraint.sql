-- Fix for Bug 2: Work type constraint blocking custom work types from syncing
-- Run this directly in the Supabase SQL Editor

ALTER TABLE work_entries DROP CONSTRAINT IF EXISTS work_entries_work_type_check;
