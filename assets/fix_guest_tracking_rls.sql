-- =========================================================================
-- CHHOTU MOTORCYCLES WORKSHOP — FIX GUEST BOOKING TRACKING & RLS POLICIES
-- Run this in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/qvnjjvbmethdvmlzeoow/sql)
-- =========================================================================

-- 1. Ensure RLS is active on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 2. Allow public/guests to create bookings
DROP POLICY IF EXISTS "Allow public insert to bookings" ON public.bookings;
CREATE POLICY "Allow public insert to bookings" ON public.bookings
    FOR INSERT WITH CHECK (true);

-- 3. Allow customers to view their own bookings AND guest bookings (so tracking by ID works)
DROP POLICY IF EXISTS "Allow owners to read their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can view their own bookings" ON public.bookings;
CREATE POLICY "Customers can view their own bookings" ON public.bookings
    FOR SELECT USING (
        user_id = auth.uid() 
        OR user_id IS NULL 
        OR public.check_user_is_admin_or_staff(auth.uid())
    );

-- 4. Allow authenticated users to claim guest bookings (link user_id to their account)
DROP POLICY IF EXISTS "Customers can update their own bookings" ON public.bookings;
CREATE POLICY "Customers can update their own bookings" ON public.bookings
    FOR UPDATE TO authenticated 
    USING (user_id = auth.uid() OR user_id IS NULL) 
    WITH CHECK (user_id = auth.uid());

-- 5. Helper RPC to auto-claim guest booking by ID or Phone for logged in user
CREATE OR REPLACE FUNCTION public.claim_guest_booking(p_booking_id UUID DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF p_booking_id IS NOT NULL THEN
        UPDATE public.bookings
        SET user_id = v_user_id
        WHERE id = p_booking_id AND user_id IS NULL;
    END IF;

    IF p_phone IS NOT NULL AND length(p_phone) >= 7 THEN
        UPDATE public.bookings
        SET user_id = v_user_id
        WHERE (phone = p_phone OR phone LIKE '%' || right(p_phone, 8) || '%') AND user_id IS NULL;
    END IF;

    RETURN TRUE;
END;
$$;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';
