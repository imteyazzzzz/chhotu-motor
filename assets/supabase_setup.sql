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
DECLARE
    v_phone TEXT;
    v_name TEXT;
BEGIN
    v_phone := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
    v_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Customer');

    -- 1. Insert or update profile first
    BEGIN
        INSERT INTO public.profiles (id, full_name, phone, role)
        VALUES (
            NEW.id,
            v_name,
            v_phone,
            'customer'
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
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

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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


-- =========================================================================
-- MIGRATION: MECHANIC PORTAL TABLES & SECURITIES
-- =========================================================================

-- 1. Alter bookings to add mechanic portal fields
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS mechanic_token UUID DEFAULT gen_random_uuid() NOT NULL,
ADD COLUMN IF NOT EXISTS mechanic_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mechanic_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Ensure constraint exists
DO $$
BEGIN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_mechanic_token_key UNIQUE (mechanic_token);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- 2. Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    base_charge NUMERIC DEFAULT 400.0,
    parts_total NUMERIC DEFAULT 0.0,
    total_amount NUMERIC DEFAULT 400.0,
    payment_method TEXT CHECK (payment_method IN ('cash', 'upi')),
    status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Staff can manage invoices" ON public.invoices;
CREATE POLICY "Admin/Staff can manage invoices" ON public.invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );

DROP POLICY IF EXISTS "Customers can view own invoices" ON public.invoices;
CREATE POLICY "Customers can view own invoices" ON public.invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.bookings 
            WHERE bookings.id = invoices.booking_id AND bookings.user_id = auth.uid()
        )
    );


-- 3. Create invoice_items table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Staff can manage invoice items" ON public.invoice_items;
CREATE POLICY "Admin/Staff can manage invoice items" ON public.invoice_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE invoices.id = invoice_items.invoice_id AND EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
            )
        )
    );


-- 4. Secure Database RPC: Load Job Details by Token
CREATE OR REPLACE FUNCTION public.get_mechanic_job_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking RECORD;
    v_profile RECORD;
    v_invoice RECORD;
    v_invoice_items JSONB;
    v_result JSONB;
BEGIN
    -- Fetch booking
    SELECT * INTO v_booking 
    FROM public.bookings 
    WHERE mechanic_token = p_token;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Expiry Check: Paid bookings expire after 5 minutes
    IF v_booking.status = 'paid' AND v_booking.paid_at IS NOT NULL AND (v_booking.paid_at + interval '5 minutes') < now() THEN
        RETURN JSONB_BUILD_OBJECT('expired', true);
    END IF;

    -- Fetch customer info
    SELECT full_name, phone INTO v_profile
    FROM public.profiles
    WHERE id = v_booking.user_id;

    -- Fetch invoice
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE booking_id = v_booking.id;

    IF FOUND THEN
        SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('description', description, 'amount', amount)), '[]'::JSONB)
        INTO v_invoice_items
        FROM public.invoice_items
        WHERE invoice_id = v_invoice.id;
    ELSE
        v_invoice_items := '[]'::JSONB;
    END IF;

    v_result := JSONB_BUILD_OBJECT(
        'expired', false,
        'booking', JSONB_BUILD_OBJECT(
            'id', v_booking.id,
            'created_at', v_booking.created_at,
            'status', v_booking.status,
            'service_type', v_booking.service_type,
            'bike_brand', v_booking.bike_brand,
            'bike_model', v_booking.bike_model,
            'registration_no', v_booking.registration_no,
            'location', v_booking.location,
            'coordinates', v_booking.coordinates,
            'issue_description', v_booking.issue_description,
            'mechanic_started_at', v_booking.mechanic_started_at,
            'mechanic_completed_at', v_booking.mechanic_completed_at,
            'paid_at', v_booking.paid_at
        ),
        'customer', JSONB_BUILD_OBJECT(
            'full_name', COALESCE(v_profile.full_name, 'Customer'),
            'phone', COALESCE(v_profile.phone, '')
        ),
        'invoice', CASE WHEN v_invoice.id IS NOT NULL THEN
            JSONB_BUILD_OBJECT(
                'id', v_invoice.id,
                'base_charge', v_invoice.base_charge,
                'parts_total', v_invoice.parts_total,
                'total_amount', v_invoice.total_amount,
                'payment_method', v_invoice.payment_method,
                'status', v_invoice.status,
                'items', v_invoice_items
            )
        ELSE NULL END
    );

    RETURN v_result;
END;
$$;


-- 5. Secure Database RPC: Update Job status
CREATE OR REPLACE FUNCTION public.update_mechanic_job_status(p_token UUID, p_status TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_current_status TEXT;
    v_paid_at TIMESTAMPTZ;
BEGIN
    SELECT id, status, paid_at INTO v_booking_id, v_current_status, v_paid_at
    FROM public.bookings
    WHERE mechanic_token = p_token;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Expiry check
    IF v_current_status = 'paid' AND v_paid_at IS NOT NULL AND (v_paid_at + interval '5 minutes') < now() THEN
        RETURN FALSE;
    END IF;

    -- Status validations & timestamps logging
    IF p_status = 'en_route' THEN
        UPDATE public.bookings 
        SET status = 'en_route' 
        WHERE id = v_booking_id;
    ELSIF p_status = 'in_progress' THEN
        UPDATE public.bookings 
        SET status = 'in_progress', mechanic_started_at = COALESCE(mechanic_started_at, now()) 
        WHERE id = v_booking_id;
    ELSE
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;


-- 6. Secure Database RPC: Complete work and build invoice
CREATE OR REPLACE FUNCTION public.complete_mechanic_job_with_invoice(p_token UUID, p_parts JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_user_id UUID;
    v_current_status TEXT;
    v_paid_at TIMESTAMPTZ;
    v_base_charge NUMERIC := 400.0;
    v_parts_total NUMERIC := 0.0;
    v_invoice_id UUID;
    v_part RECORD;
BEGIN
    SELECT id, user_id, status, paid_at INTO v_booking_id, v_user_id, v_current_status, v_paid_at
    FROM public.bookings
    WHERE mechanic_token = p_token;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_current_status = 'paid' AND v_paid_at IS NOT NULL AND (v_paid_at + interval '5 minutes') < now() THEN
        RETURN FALSE;
    END IF;

    IF v_current_status IN ('completed', 'paid') THEN
        RETURN FALSE;
    END IF;

    -- Check if upfront deposit of 200 was verified
    IF EXISTS (SELECT 1 FROM public.bookings WHERE id = v_booking_id AND payment_status = 'verified') THEN
        v_base_charge := 200.0; -- Discount Rs. 200 already paid
    END IF;

    -- Calculate invoice items sum
    SELECT COALESCE(SUM((val->>'amount')::NUMERIC), 0.0) INTO v_parts_total
    FROM jsonb_array_elements(p_parts) AS val;

    -- Insert invoice
    INSERT INTO public.invoices (booking_id, base_charge, parts_total, total_amount, payment_method, status, created_at)
    VALUES (v_booking_id, v_base_charge, v_parts_total, v_base_charge + v_parts_total, 'cash', 'unpaid', now())
    RETURNING id INTO v_invoice_id;

    -- Insert individual items
    FOR v_part IN SELECT (val->>'description')::TEXT AS descr, (val->>'amount')::NUMERIC AS amt FROM jsonb_array_elements(p_parts) AS val
    LOOP
        INSERT INTO public.invoice_items (invoice_id, description, amount, created_at)
        VALUES (v_invoice_id, v_part.descr, v_part.amt, now());
    END LOOP;

    -- Mark booking completed
    UPDATE public.bookings
    SET status = 'completed', mechanic_completed_at = COALESCE(mechanic_completed_at, now())
    WHERE id = v_booking_id;

    RETURN TRUE;
END;
$$;


-- 7. Secure Database RPC: Record payment confirmation
CREATE OR REPLACE FUNCTION public.mark_mechanic_job_paid(p_token UUID, p_method TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_booking_id UUID;
    v_user_id UUID;
    v_current_status TEXT;
BEGIN
    SELECT id, user_id, status INTO v_booking_id, v_user_id, v_current_status
    FROM public.bookings
    WHERE mechanic_token = p_token;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_current_status = 'paid' THEN
        RETURN TRUE;
    END IF;

    -- Update invoice to paid
    UPDATE public.invoices
    SET status = 'paid', payment_method = p_method, paid_at = now()
    WHERE booking_id = v_booking_id;

    -- Update booking status to paid
    UPDATE public.bookings
    SET status = 'paid', paid_at = now()
    WHERE id = v_booking_id;

    RETURN TRUE;
END;
$$;


-- =========================================================================
-- MIGRATION: BOOKING PAYMENT & VERIFICATION FLOW
-- =========================================================================

-- 1. Alter bookings to add upfront payment tracking fields
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS upi_reference TEXT,
ADD COLUMN IF NOT EXISTS booking_charge_amount NUMERIC DEFAULT 249.0,
ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 2. Drop existing constraint if exists to update status check list
DO $$
BEGIN
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending_verification', 'payment_rejected', 'pending', 'assigned', 'confirmed', 'dispatched', 'en_route', 'in_progress', 'completed', 'paid', 'cancelled'));
    
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN ('none', 'submitted', 'verified', 'rejected'));
    
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_refund_status_check;
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_refund_status_check CHECK (refund_status IN ('none', 'pending', 'applied', 'refunded'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Create Storage bucket and RLS policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-screenshots', 'payment-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- RLS check
-- We drop existing policies first to be safe
DROP POLICY IF EXISTS "Allow public upload to payment-screenshots" ON storage.objects;
CREATE POLICY "Allow public upload to payment-screenshots" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-screenshots');

DROP POLICY IF EXISTS "Allow admins to view screenshots" ON storage.objects;
CREATE POLICY "Allow admins to view screenshots" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'payment-screenshots' AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );
