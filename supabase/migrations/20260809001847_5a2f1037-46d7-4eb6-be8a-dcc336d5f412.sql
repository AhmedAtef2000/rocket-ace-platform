CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rl_consume(_key TEXT, _limit INTEGER, _window_seconds INTEGER)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.rate_limits%ROWTYPE;
BEGIN
  INSERT INTO public.rate_limits (bucket_key, window_started_at, hits, updated_at)
  VALUES (_key, now(), 0, now())
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO row FROM public.rate_limits WHERE bucket_key = _key FOR UPDATE;

  IF row.window_started_at < now() - make_interval(secs => _window_seconds) THEN
    UPDATE public.rate_limits
      SET window_started_at = now(), hits = 1, updated_at = now()
      WHERE bucket_key = _key
      RETURNING * INTO row;
  ELSE
    UPDATE public.rate_limits
      SET hits = row.hits + 1, updated_at = now()
      WHERE bucket_key = _key
      RETURNING * INTO row;
  END IF;

  allowed := row.hits <= _limit;
  remaining := GREATEST(_limit - row.hits, 0);
  retry_after_seconds := GREATEST(
    CEIL(EXTRACT(EPOCH FROM (row.window_started_at + make_interval(secs => _window_seconds) - now())))::INTEGER,
    0
  );
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.rl_consume(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rl_consume(TEXT, INTEGER, INTEGER) TO service_role;