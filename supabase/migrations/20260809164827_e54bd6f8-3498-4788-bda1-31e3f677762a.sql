CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  site_name text NOT NULL DEFAULT 'AstroBet',
  tagline text NOT NULL DEFAULT 'Cash out before the rocket crashes.',
  logo_url text,
  support_email text NOT NULL DEFAULT 'support@astrobet.app',
  maintenance_mode boolean NOT NULL DEFAULT false,
  house_edge_note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon;
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform settings are readable by everyone"
ON public.platform_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER trg_platform_settings_updated
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;