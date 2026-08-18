-- =========================================================================
-- MASTER SCHEMA UPDATES: UPFRONT & FINAL PAYMENT COLUMNS
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
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS registration_no TEXT;

-- 2. Alter bookings to add final payment tracking columns
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS final_payment_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS final_payment_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS final_payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS final_payment_upi_reference TEXT,
ADD COLUMN IF NOT EXISTS final_payment_upi_extracted TEXT,
ADD COLUMN IF NOT EXISTS final_payment_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS final_payment_amount_extracted NUMERIC,
ADD COLUMN IF NOT EXISTS final_payment_date_extracted TEXT;

-- 2. Drop and recreate status check constraint to include final payment states
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
    CHECK (status IN (
        'pending_verification', 
        'payment_rejected', 
        'pending', 
        'assigned', 
        'confirmed', 
        'dispatched', 
        'en_route', 
        'in_progress', 
        'completed_awaiting_payment', 
        'payment_submitted', 
        'payment_verified', 
        'paid', 
        'cancelled'
    ));

-- 3. Create payment_audit_logs table to keep a secure, persistent audit trail
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    extracted_amount NUMERIC,
    extracted_upi_ref TEXT,
    extracted_status TEXT,
    decision TEXT NOT NULL, -- 'verified', 'rejected', 'manual_review', 'duplicate'
    log_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and add policy
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Staff can manage audit logs" ON public.payment_audit_logs;
CREATE POLICY "Admin/Staff can manage audit logs" ON public.payment_audit_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'staff')
        )
    );

-- 4. Update complete_mechanic_job_with_invoice database RPC function
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

    IF v_current_status = 'payment_verified' AND v_paid_at IS NOT NULL AND (v_paid_at + interval '5 minutes') < now() THEN
        RETURN FALSE;
    END IF;

    -- Avoid double submission
    IF v_current_status IN ('completed_awaiting_payment', 'payment_submitted', 'payment_verified', 'paid') THEN
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

    -- Mark booking completed, awaiting payment
    UPDATE public.bookings
    SET status = 'completed_awaiting_payment', mechanic_completed_at = COALESCE(mechanic_completed_at, now())
    WHERE id = v_booking_id;

    RETURN TRUE;
END;
$$;

-- 5. Update mark_mechanic_job_paid database RPC function
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

    IF v_current_status = 'payment_verified' THEN
        RETURN TRUE;
    END IF;

    -- Update invoice to paid
    UPDATE public.invoices
    SET status = 'paid', payment_method = p_method, paid_at = now()
    WHERE booking_id = v_booking_id;

    -- Update booking status to payment_verified
    UPDATE public.bookings
    SET status = 'payment_verified', 
        final_payment_status = 'verified',
        final_payment_verified_at = now()
    WHERE id = v_booking_id;

    RETURN TRUE;
END;
$$;


-- 6. Secure Database RPC: Update payment tracking fields by AI Agent
CREATE OR REPLACE FUNCTION public.update_booking_payment_by_agent(
    p_booking_id UUID,
    p_status TEXT,
    p_final_status TEXT,
    p_rejection_reason TEXT,
    p_upi_extracted TEXT,
    p_amount_extracted NUMERIC,
    p_date_extracted TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.bookings
    SET status = p_status,
        final_payment_status = p_final_status,
        final_payment_rejection_reason = p_rejection_reason,
        final_payment_upi_extracted = p_upi_extracted,
        final_payment_amount_extracted = p_amount_extracted,
        final_payment_date_extracted = p_date_extracted,
        final_payment_verified_at = CASE WHEN p_final_status = 'verified' THEN now() ELSE final_payment_verified_at END
    WHERE id = p_booking_id;

    -- If verified, also update invoice status
    IF p_final_status = 'verified' THEN
        UPDATE public.invoices
        SET status = 'paid',
            paid_at = now()
        WHERE booking_id = p_booking_id;
    END IF;

    RETURN TRUE;
END;
$$;


-- 7. Solve infinite recursion on profiles policy by creating a SECURITY DEFINER function
CREATE OR REPLACE FUNCTION public.check_user_is_admin_or_staff(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_uuid AND role IN ('admin', 'staff')
    );
END;
$$;

DROP POLICY IF EXISTS "Admin/Staff can view all profiles" ON public.profiles;
CREATE POLICY "Admin/Staff can view all profiles" ON public.profiles
    FOR SELECT USING (
        public.check_user_is_admin_or_staff(auth.uid())
    );


-- 8. Clean up any empty strings to NULL to allow multiple accounts without phone numbers
UPDATE public.profiles
SET phone = NULL
WHERE phone = '';

-- Clean up any duplicate phone numbers (keep only the first row per duplicate phone)
WITH duplicates AS (
    SELECT id, ROW_NUMBER() OVER(PARTITION BY phone ORDER BY created_at ASC) as rn
    FROM public.profiles
    WHERE phone IS NOT NULL
)
UPDATE public.profiles
SET phone = NULL
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on phone column of profiles table
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_unique;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);

-- 9. Update handle_new_user trigger function to use NULL instead of empty string for phone
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, avatar_url, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'Customer'),
        NULLIF(new.raw_user_meta_data->>'phone', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'customer'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone);

    INSERT INTO public.addresses (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.notification_preferences (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Ensure all user_ids in bookings exist in profiles, or set them to NULL to avoid constraint validation errors
UPDATE public.bookings
SET user_id = NULL
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Link user_id in bookings directly to profiles(id)
ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_user_id_fkey,
DROP CONSTRAINT IF EXISTS bookings_user_id_profiles_fkey;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- Link actor_id in bookings_activity directly to profiles(id)
ALTER TABLE public.bookings_activity
DROP CONSTRAINT IF EXISTS bookings_activity_actor_id_fkey,
DROP CONSTRAINT IF EXISTS bookings_activity_actor_id_profiles_fkey;

ALTER TABLE public.bookings_activity
ADD CONSTRAINT bookings_activity_actor_id_profiles_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- Link select access on invoice_items to access on the parent invoice
DROP POLICY IF EXISTS "Customers can view own invoice items" ON public.invoice_items;
CREATE POLICY "Customers can view own invoice items" ON public.invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            WHERE invoices.id = invoice_items.invoice_id
        )
    );


-- 10. Force Supabase PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
