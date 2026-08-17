-- =========================================================================
-- CHHOTU MOTORCYCLES WORKSHOP — COMPLETE DATABASE SETUP & MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor.
-- Safe to re-run multiple times (idempotent).
-- =========================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'staff', 'admin')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Alter profiles if table already existed but role column is missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';

-- Add check constraint if missing
DO $$
BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT check_profile_role CHECK (role IN ('customer', 'staff', 'admin'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admin/Staff can view all profiles" ON public.profiles;
CREATE POLICY "Admin/Staff can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );


-- 2. Motorcycles Table (Saved Bikes)
CREATE TABLE IF NOT EXISTS public.motorcycles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    registration_no TEXT,
    type TEXT DEFAULT 'motorcycle',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.motorcycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own motorcycles" ON public.motorcycles;
CREATE POLICY "Users can view their own motorcycles" ON public.motorcycles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own motorcycles" ON public.motorcycles;
CREATE POLICY "Users can insert their own motorcycles" ON public.motorcycles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own motorcycles" ON public.motorcycles;
CREATE POLICY "Users can update their own motorcycles" ON public.motorcycles
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own motorcycles" ON public.motorcycles;
CREATE POLICY "Users can delete their own motorcycles" ON public.motorcycles
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin/Staff can view all motorcycles" ON public.motorcycles;
CREATE POLICY "Admin/Staff can view all motorcycles" ON public.motorcycles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );


-- 3. Addresses Table (Saved Home/Office Slots)
CREATE TABLE IF NOT EXISTS public.addresses (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    home_address TEXT,
    office_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own addresses" ON public.addresses;
CREATE POLICY "Users can view their own addresses" ON public.addresses
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their own addresses" ON public.addresses;
CREATE POLICY "Users can upsert their own addresses" ON public.addresses
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin/Staff can view all addresses" ON public.addresses;
CREATE POLICY "Admin/Staff can view all addresses" ON public.addresses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );


-- 4. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    booking_whatsapp BOOLEAN DEFAULT true,
    booking_sms BOOLEAN DEFAULT false,
    booking_email BOOLEAN DEFAULT true,
    promo_whatsapp BOOLEAN DEFAULT false,
    promo_email BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert their own preferences" ON public.notification_preferences;
CREATE POLICY "Users can upsert their own preferences" ON public.notification_preferences
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin/Staff can view all preferences" ON public.notification_preferences;
CREATE POLICY "Admin/Staff can view all preferences" ON public.notification_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );


-- 5. Trigger: Auto Create Profiles & Preferences on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, avatar_url, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Customer'),
        COALESCE(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.addresses (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 6. Mechanics Table
CREATE TABLE IF NOT EXISTS public.mechanics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    specialty TEXT NOT NULL,
    on_duty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and staff can manage mechanics" ON public.mechanics;
CREATE POLICY "Admin and staff can manage mechanics" ON public.mechanics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Customers can view mechanics" ON public.mechanics;
CREATE POLICY "Customers can view mechanics" ON public.mechanics
    FOR SELECT USING (true);


-- 7. Update bookings table columns
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assigned_mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE SET NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT;

DROP POLICY IF EXISTS "Admin/Staff full access to bookings" ON public.bookings;
CREATE POLICY "Admin/Staff full access to bookings" ON public.bookings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );


-- 8. Bookings Activity Table
CREATE TABLE IF NOT EXISTS public.bookings_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bookings_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin and staff can view bookings activity" ON public.bookings_activity;
CREATE POLICY "Admin and staff can view bookings activity" ON public.bookings_activity
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );
