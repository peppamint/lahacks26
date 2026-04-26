-- Fix RLS for demo app
-- Run this in your Supabase SQL Editor

-- Option 1: Disable RLS on profiles table (for demo only)
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Option 2: Create permissive RLS policy (better for production)
-- DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
-- CREATE POLICY "Users can insert their own profile" ON profiles
--   FOR INSERT WITH CHECK (auth.uid()::text = id OR auth.uid() IS NULL);

-- Also ensure RLS is disabled on other tables for demo
ALTER TABLE progress_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE word_bank DISABLE ROW LEVEL SECURITY;