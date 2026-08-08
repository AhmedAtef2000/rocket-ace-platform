# Rocket Flight — Phase 1: System Architecture

## 0. Stack reality check (read first)

This workspace is a **TanStack Start (React 19 + Vite) app on Lovable Cloud**, not a Next.js + NestJS + Prisma + Redis/BullMQ monorepo. Lovable cannot run a separate NestJS process, a self-managed Redis, or BullMQ workers.

Two viable paths — pick one before Phase 2:

- **A. Build here (recommended for a working product).** Map the same domain architecture onto: TanStack Start routes + server functions (API layer), Lovable Cloud Postgres (source of truth, SQL migrations + RLS), Postgres advisory locks + `SELECT ... FOR UPDATE` for concurrency, `pg_cron`/scheduled server routes for the round loop, Supabase Realtime for game broadcast. Everything in sections 1–20 below still holds; only the runtime names change.
- **B. Reference architecture only.** I write the full Nest/Prisma monorepo as source files here; you run it elsewhere with Docker. Nothing is executable in the preview.

Everything below is written stack-neutral, with the Path A binding named per section.

## 1. System architecture

```text
Client (web + admin, React/TS)
   |  HTTPS, HTTP-only session cookie
Edge / WAF  (rate limit, bot, geo)
   |
API layer (typed RPC + REST webhooks)   <-- authoritative for all state
   |            |                 |
Game engine   Ledger core     Integrations
(round loop)  (double entry)  (payments, KYC, AML, email)
   |            |                 |
Realtime bus  PostgreSQL (durable, financial truth)
```

Server is authoritative for balance, bet, crash point, cashout, payouts, deposit and withdrawal status. Client renders server events only.

## 2. Folder structure (Path A)

```text
src/
  routes/                 web pages + /admin + api/public/webhooks/*
  domain/
    auth/ users/ wallet/ ledger/ game/ fairness/ bets/
    payments/ withdrawals/ kyc/ jurisdiction/ risk/ rg/
    bonuses/ notifications/ support/ admin/ audit/ analytics/
  lib/*.functions.ts      server-fn boundary (thin wrappers)
  domain/**/*.server.ts   business logic, never client-imported
supabase/migrations/      versioned SQL
tests/                    unit, integration, concurrency, e2e
```

Modular monolith. Each domain: service (logic) + repo (data) + Zod schemas + tests. No logic in route handlers.

## 3. ERD (core relations)

```text
users 1-1 user_profiles, 1-N user_sessions, 1-N wallets
wallets 1-N deposits / withdrawals / bets
ledger_accounts 1-N ledger_entries   (entries grouped by transaction_id)
game_rounds 1-1 provably_fair_seeds, 1-N bets, 1-1 game_results
bets 1-0..1 cashouts
users 1-N kyc_cases / risk_events / support_tickets / notifications
users 1-1 responsible_gambling_limits
admin_users N-N permissions via admin_roles + role_permissions
audit_logs -> polymorphic (resource_type, resource_id)
```

## 4. Schema principles

UUID v4 PKs. Money = `NUMERIC(38,18)`; never JS floats — decimal library server-side, strings over the wire. Enums as Postgres enum types for every status list in the brief. Indexes exactly as section 53. Constraints: unique `(user_id,currency)` on wallets, unique `round_number`, unique `(provider, provider_transaction_id)` on deposits and withdrawals, unique `(bet_id)` on cashouts, `CHECK (amount > 0)`, `CHECK (available_amount >= 0)`. Every public table gets explicit GRANTs plus RLS: users read only their own rows; all writes go through privileged server code.

## 5. Module architecture

Auth, Users, Wallet, Ledger, Game, Bet, Fairness, Payment, Withdrawal, Kyc, Jurisdiction, Risk, Bonus, ResponsibleGambling, Notification, Support, Admin, Audit, Analytics. Dependencies point inward: Ledger depends on nothing; Wallet depends on Ledger; Bet depends on Wallet + Game + Risk + RG; Withdrawal depends on Wallet + Kyc + Risk + RG.

## 6. API architecture

`/api/v1` surface exactly as sections 38–39. Typed server functions for app calls; raw HTTP routes only for provider webhooks under `api/public/webhooks/:provider` (signature verified inside the handler). Uniform envelope; error codes per section 41; `requestId` on every response. Financial POSTs require an `Idempotency-Key` persisted in an `idempotency_keys` table keyed by (user, endpoint, key) with the stored response replayed on repeat.

## 7. Authentication

Argon2id, HTTP-only + Secure + SameSite=Lax session cookie, short-lived access token + rotating refresh, TOTP MFA with recovery codes, step-up MFA for withdrawals and security changes, device/session registry with revoke, brute-force lockout and per-IP rate limits, email verification and password reset with single-use expiring tokens.

## 8. Wallet

One wallet per (user, currency), `available_amount` + `locked_amount`, plus a hard-separated `DEMO` wallet class that can never fund or be funded by real money. Wallet rows are a **projection**; the ledger is truth. A nightly reconciliation job asserts wallet == sum(ledger) per account and raises a critical alert on drift.

## 9. Ledger

Immutable, append-only, double-entry. Every mutation writes >= 2 entries under one `transaction_id`, debits == credits per currency, inside one DB transaction. Account types: USER_WALLET, USER_LOCKED, HOUSE, BONUS_LIABILITY, EXTERNAL_PAYMENT, FEE. Deposit, bet, win, withdrawal flows as in section 9 of the brief. No updates, no deletes — corrections are compensating transactions referencing the original.

## 10. Game engine

Single authoritative round loop, states CREATED → BETTING → RUNNING → CRASHED → SETTLING → SETTLED (or CANCELLED), transitions guarded by a DB state machine so an invalid transition is rejected and a SETTLED round can never re-run. Crash point is fixed at round creation from the seed, before any bet exists. Multiplier is a pure function of elapsed time — broadcast at high frequency, persisted never. Only round lifecycle events and settlements hit Postgres. Recovery on restart: load any non-terminal round, replay from persisted timestamps, settle deterministically; bets in an unrecoverable round are refunded.

## 11. Provably fair

Versioned algorithm. Per round: server seed (random 32 bytes, stored encrypted), published `sha256(server_seed)` before betting opens, client seed (user-settable, default from a public chain-independent commitment), nonce. Crash = HMAC-SHA256(server_seed, client_seed:nonce) → uniform → house-edge-adjusted crash multiplier. Server seed revealed after the round; a public verifier page reproduces the result. No admin surface can set, force, or edit any outcome — the write path for `crash_multiplier` exists only inside the engine.

## 12. Payment provider abstraction

`PaymentProvider` interface: `createDepositAddress`, `getDeposit`, `createPayout`, `getPayout`, `verifyWebhook`. Concrete adapters are configuration-selected; currencies and networks are DB-configured rows, not constants. No fake blockchain code will be written — until a licensed provider's credentials exist, adapters throw `PROVIDER_NOT_CONFIGURED`. Webhook handling: verify HMAC signature, replay window, dedupe by `(provider, provider_transaction_id)` unique index, validate amount/currency/network/address/confirmations, credit only at required confirmations, inside one transaction with the ledger write.

## 13. KYC / AML

`KycProvider` interface (start case, fetch status, webhook verify). We store case state, risk level, and decisions — not raw documents. Sensitive fields encrypted at rest. Tiered gates: register → deposit → withdraw, each with its own KYC threshold. Jurisdiction service: country/region allowlist, age check from date of birth, VPN/proxy signal, licence config; ineligible users get `JURISDICTION_RESTRICTED` and no real-money play.

## 14. Risk architecture

Rule-based scoring engine emitting `risk_events` with type, score, severity, source. Triggers review workflows only — never automated accusations. Hooks on deposit, withdrawal, login, device fingerprint, bet velocity. High-value or high-risk withdrawals route to RISK_REVIEW and dual approval.

## 15. Admin RBAC

`admin_users` → `admin_roles` → `role_permissions` → granular `permissions` (e.g. `withdrawal.approve`, `kyc.decide`, `user.suspend`). Deny by default, checked server-side on every admin call. SUPER_ADMIN has full operational rights and still no ability to alter historical game outcomes, ledger rows, or crash points. Every admin action writes an append-only audit log.

## 16. Realtime

Channel `/game`, events exactly as section 19. Server publishes; clients are read-only subscribers. Bet placement and cashout go over the authenticated API, not the socket. Reconnect resyncs from `GET /game/round/current` with the server's authoritative elapsed time.

## 17. Security

HTTPS/HSTS, CSP, CORS allowlist, CSRF tokens on cookie-authed mutations, XSS output encoding, parameterised SQL only, layered rate limits, secrets in the managed secret store (never in git), webhook signature + replay protection, idempotency, RBAC, audit logging, Zod validation on every input. Never exposed: private keys, provider credentials, unrevealed server seeds, internal risk rules, raw KYC data.

## 18. Deployment

Path A: Lovable-managed edge hosting + Cloud Postgres, separate preview and production environments with separate provider credentials; production payment keys never present in dev. Versioned SQL migrations, automated backups, health endpoints, structured logs with requestId/userId/route/status/duration, Sentry-compatible error reporting. Path B additionally ships Dockerfiles and docker-compose.

## 19. Testing

Unit: ledger invariants, decimal math, bet validation, cashout, payout, fairness vectors, limits, KYC gating. Integration: deposit→webhook→ledger→wallet, bet→settlement, withdrawal reservation→approval→payout, KYC→status, risk→review. Concurrency: 100 simultaneous cashouts, duplicate cashout, duplicate withdrawal, duplicate webhook, crash/cashout race, restart mid-round. E2E: register → verify → KYC → deposit → bet → cashout → transactions → withdraw.

## 20. Roadmap

Phases 2–22 exactly as the brief's ordering: schema, auth, users, wallet, ledger, demo engine, fairness, realtime, betting/cashout, KYC, RG, risk, payment abstraction, deposits, withdrawals, admin, analytics, support, hardening, tests, deploy. Real-money integrations stay disabled and clearly marked placeholder until licensed provider credentials and a licence configuration are supplied; DEMO mode is what runs before then.

## Decision needed

Confirm **Path A** or **Path B**, and confirm demo-only until licensing/provider details exist. Then I start Phase 2 (schema + migrations).
