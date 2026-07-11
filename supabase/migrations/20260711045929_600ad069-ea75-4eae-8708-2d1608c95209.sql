
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Site state (single JSON blob keyed by 'default')
CREATE TABLE public.site_state (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_state TO anon;
GRANT SELECT, INSERT, UPDATE ON public.site_state TO authenticated;
GRANT ALL ON public.site_state TO service_role;
ALTER TABLE public.site_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site state"
  ON public.site_state FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins insert site state"
  ON public.site_state FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update site state"
  ON public.site_state FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_state (key, data) VALUES ('default', '{}'::jsonb)
  ON CONFLICT (key) DO NOTHING;

-- Booking inquiries
CREATE TABLE public.booking_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL DEFAULT ('BAIA-' || lpad((floor(random()*900000)+100000)::text, 6, '0')),
  check_in date NOT NULL,
  check_out date NOT NULL,
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guests_count int NOT NULL DEFAULT 2,
  room_tier_id text,
  room_tier_name text,
  total_nights int NOT NULL DEFAULT 1,
  total_price numeric NOT NULL DEFAULT 0,
  special_requests text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.booking_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.booking_inquiries TO authenticated;
GRANT ALL ON public.booking_inquiries TO service_role;
ALTER TABLE public.booking_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a booking inquiry"
  ON public.booking_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins can view inquiries"
  ON public.booking_inquiries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update inquiries"
  ON public.booking_inquiries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete inquiries"
  ON public.booking_inquiries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
