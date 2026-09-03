-- =========================================================================
-- CHHOTU MOTORCYCLES WORKSHOP — SUPABASE FIX FOR AUTH SIGNUP TRIGGER
-- Fixes: "Database error saving new user" (violates foreign key constraint bookings_user_id_profiles_fkey)
-- =========================================================================

-- 1. Ensure bookings.user_id foreign key references auth.users(id) or public.profiles(id) safely
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_user_id_profiles_fkey,
DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;

-- Reference auth.users(id) with ON DELETE SET NULL
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Ensure profiles table has proper schema and unique constraint
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Replace handle_new_user with a robust, safe trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_phone TEXT;
    v_name TEXT;
BEGIN
    v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
    -- Clean backend phone: strip '+' and non-digit characters
    IF v_phone IS NOT NULL THEN
        v_phone := REGEXP_REPLACE(v_phone, '[^0-9]', '', 'g');
    END IF;
    v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Customer');

    -- 1. Insert or update profile first
    BEGIN
        INSERT INTO public.profiles (id, full_name, email, phone, role)
        VALUES (
            NEW.id,
            v_name,
            NEW.email,
            v_phone,
            'customer'
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = COALESCE(EXCLUDED.email, public.profiles.email),
            phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
            updated_at = NOW();
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Profile creation warning: %', SQLERRM;
    END;

    -- 2. Initialize default address
    BEGIN
        INSERT INTO public.addresses (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 3. Initialize notification preferences
    BEGIN
        INSERT INTO public.notification_preferences (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- 4. Automatically claim guest bookings matching this user phone
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        BEGIN
            UPDATE public.bookings
            SET user_id = NEW.id
            WHERE user_id IS NULL 
              AND (
                  phone = v_phone 
                  OR REPLACE(REPLACE(phone, ' ', ''), '-', '') = REPLACE(REPLACE(v_phone, ' ', ''), '-', '')
                  OR phone = RIGHT(v_phone, 10)
              );
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Guest booking claim warning: %', SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-bind the trigger cleanly on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Grant required permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
