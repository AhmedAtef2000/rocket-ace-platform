ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS betting_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS withdrawals_blocked boolean NOT NULL DEFAULT false;