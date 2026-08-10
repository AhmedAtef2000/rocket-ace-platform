# Plan: Enable Real-Money Play on Astro Bet

## Goal
Move Astro Bet from demo-only play to real-money play by wiring real-currency wallets into the game engine, deposits, withdrawals, and compliance gates, while keeping everything testable in sandbox mode until licensing is complete.

## Scope
1. Payment provider setup and sandbox configuration
2. Database/schema hardening for real wallets and transactions
3. Game engine update to bet with real currency
4. Wallet, deposit, and withdrawal UX updates
5. Compliance gating before real-money actions
6. Admin monitoring for real-money activity
7. Sandbox safety switches

## Technical Details

### 1. Payment Provider Setup
- Run `recommend_payment_provider` to check Lovable Payments fit.
- If gambling is restricted (expected), document that standard Paddle/Stripe/Shopify integrations are not suitable for unlicensed gambling.
- Keep the existing manual deposit/withdrawal request flow as the primary real-money path for sandbox testing.
- Add a clear "sandbox mode" banner so no live card processing is implied.

### 2. Database Hardening
- Ensure every user has one active real wallet per supported fiat currency (USD, EUR, EGP) on signup.
- Add `real_money_enabled` flag to `public.users` (default false).
- Add `preferred_currency` and `play_mode` (DEMO/REAL) to `public.users`.
- Enforce that real-wallet bets are only allowed when `real_money_enabled = true`.
- Add `GRANT`s and RLS policies for any new columns.

### 3. Game Engine Update
- Modify `game_place_bet` to accept a `mode` parameter (DEMO or REAL).
- When mode is REAL:
  - Resolve the user's active real wallet in the selected currency.
  - Call `assertRealMoneyEligible` before placing the bet.
  - Lock real funds instead of demo funds.
  - Record `kind = 'REAL'` on the bet.
- Update cashout and settlement logic to handle real wallets.
- Keep demo mode as the default for unverified users.

### 4. Wallet / Deposit / Withdrawal UX
- Add a Demo/Real mode toggle on the game page and wallet page.
- Display real wallet balance when in real mode.
- Reuse the existing wallet page design but split assets into fiat and crypto tabs.
- Wire deposit/withdrawal requests to create `manual_deposit_requests` and `withdrawals` rows.
- Show pending/recent transaction history from the ledger.

### 5. Compliance Gating
- Before any real-money bet or withdrawal, enforce:
  - Profile complete (country, date of birth)
  - Jurisdiction allowed
  - Age meets minimum
  - KYC status APPROVED
  - Account ACTIVE
- Show a clear "Complete verification to play with real money" CTA when gates are not met.
- Keep demo play available without verification.

### 6. Admin Monitoring
- Add a "Real Money" filter to the admin user search.
- Show real-wallet balances, pending deposits/withdrawals, and total real wagered/paid in the User 360 view.
- Add admin actions: approve/reject manual deposits and withdrawals.

### 7. Sandbox Safety
- Add a `platform_settings.is_real_money_live` flag (default false).
- When false, all real-money transactions are labeled "sandbox" and no external payment capture occurs.
- Display a persistent "Sandbox / Test Mode" banner to admins and players.

## Out of Scope
- Live credit card processing without a licensed gambling payment provider.
- Rigging or player-specific outcome manipulation (already declined; system stays provably fair).
- Launching to real players without licensing.

## Verification
- Typecheck passes.
- Demo play still works for unverified users.
- Real play is blocked until all compliance gates pass.
- Admin can view and manage real-money transactions.
