CREATE TABLE public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.admin_user_notes TO service_role;

ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX admin_user_notes_user_idx ON public.admin_user_notes (user_id, created_at DESC);

CREATE TRIGGER trg_admin_user_notes_updated
BEFORE UPDATE ON public.admin_user_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();