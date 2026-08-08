
DROP VIEW IF EXISTS public.fairness_public;

CREATE TABLE public.provably_fair_secrets (
  round_id UUID PRIMARY KEY REFERENCES public.game_rounds(id) ON DELETE RESTRICT,
  server_seed_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.provably_fair_secrets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.provably_fair_secrets TO service_role;
CREATE TRIGGER trg_secrets_no_delete BEFORE DELETE ON public.provably_fair_secrets FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

ALTER TABLE public.provably_fair_seeds DROP COLUMN server_seed_encrypted;
GRANT SELECT ON public.provably_fair_seeds TO anon, authenticated;
