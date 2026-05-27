-- ==========================================
-- Fix users table and trigger for email-only user creation
-- ==========================================

-- Step 1: Alter the users table to make mobile nullable and add email field
ALTER TABLE public.users ALTER COLUMN mobile DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Step 2: Drop the old trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Create the updated function with phone number format handling and email support
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  clean_mobile VARCHAR(10);
BEGIN
  -- Strip country code if present (e.g., +91 to get 10 digits)
  clean_mobile := CASE
    WHEN NEW.phone LIKE '+91%' THEN SUBSTRING(NEW.phone FROM 4 FOR 10)
    WHEN NEW.phone LIKE '91%' THEN SUBSTRING(NEW.phone FROM 3 FOR 10)
    ELSE NEW.phone
  END;
  
  -- Insert user record with either mobile or email (or both)
  INSERT INTO public.users (id, mobile, email)
  VALUES (NEW.id, clean_mobile, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
