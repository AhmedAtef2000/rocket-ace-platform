ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_number text;

CREATE OR REPLACE FUNCTION public.generate_account_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := lpad((floor(random() * 9000000000) + 1000000000)::bigint::text, 10, '0');
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE account_number = candidate) THEN
      RETURN candidate;
    END IF;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not allocate a unique account number';
    END IF;
  END LOOP;
END;
$$;

UPDATE public.users SET account_number = public.generate_account_number() WHERE account_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_account_number_key ON public.users (account_number);

CREATE OR REPLACE FUNCTION public.set_account_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := public.generate_account_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_account_number ON public.users;
CREATE TRIGGER trg_users_account_number
BEFORE INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_account_number();