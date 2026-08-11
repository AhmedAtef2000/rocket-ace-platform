# ASTROBET

You are a senior software architect, fintech engineer, backend engineer,

frontend engineer, cybersecurity engineer, database architect, real-time

systems engineer, and regulated-gambling platform engineer.

Your task is to design and build a production-grade real-money crash-game

platform called:

                    ROCKET FLIGHT

The platform must support a crash game, user accounts, real-money wallets,

crypto deposits, crypto withdrawals, KYC/AML, responsible gambling,

provably-fair game verification, risk management, customer support, analytics,

and a complete administrator dashboard.

IMPORTANT LEGAL / COMPLIANCE REQUIREMENT

This platform is intended for lawful, licensed gambling operations only.

Do not enable real-money gambling in jurisdictions where it is prohibited.

The production system must support jurisdiction restrictions, age verification,

KYC/AML requirements, responsible-gambling controls, auditability, and

integration with appropriately licensed payment/KYC providers.

Do not create mechanisms that allow an operator or administrator to secretly

manipulate individual player outcomes.

Do not create fake deposits, fake withdrawals, fake balances, fake players,

fake wins, or fake transaction records in production.

DEMO MODE may use virtual currency, but it must be clearly labelled DEMO and

must never be withdrawable or convertible into real money.

============================================================

1. PRODUCT

============================================================

Product name:

Rocket Flight

Product type:

Real-money crash gambling platform.

Core game:

A rocket launches.

The multiplier starts at 1.00x and increases continuously.

At a cryptographically determined point, the rocket crashes.

Players must cash out before the crash.

Example:

Bet = 10 USDT

Cashout = 2.00x

Payout = 20 USDT

If the rocket crashes before cashout:

Loss = 10 USDT

The server is ALWAYS authoritative.

The browser must never be trusted for:

- Balance

- Bet amount

- Cashout multiplier

- Crash point

- Game result

- Transaction status

- Deposit confirmation

- Withdrawal status

============================================================

2. TECHNOLOGY STACK

============================================================

Frontend:

- Next.js

- React

- TypeScript

- Tailwind CSS

- Responsive/mobile-first UI

Backend:

- Node.js

- NestJS

- TypeScript

- REST API

- WebSocket

Database:

- PostgreSQL

ORM:

- Prisma

Cache:

- Redis

Queue:

- BullMQ

Authentication:

- Secure HTTP-only cookies/session architecture

- JWT where appropriate

- Argon2id password hashing

- MFA

Validation:

- Zod and/or class-validator

Testing:

- Jest/Vitest

- Playwright

Infrastructure:

- Docker

- Docker Compose for local development

- Separate development/staging/production environments

Security:

- HTTPS

- Cloudflare/WAF compatible

- Rate limiting

- CSRF protection where applicable

- XSS protection

- SQL injection protection

- Security headers

- Encryption

- Secrets management

- Audit logs

Monitoring:

- Sentry

- Prometheus/Grafana compatible

API documentation:

- OpenAPI/Swagger

============================================================

3. PROJECT STRUCTURE

============================================================

Use a clean modular monorepo.

Recommended structure:

apps/

  web/

  admin/

  api/

packages/

  database/

  auth/

  wallet/

  ledger/

  game-engine/

  payments/

  kyc/

  risk/

  bonuses/

  responsible-gambling/

  notifications/

  support/

  audit/

  analytics/

  shared/

Infrastructure:

  docker/

  scripts/

  migrations/

  tests/

Do not create unnecessary microservices initially.

Use a modular monolith for the backend with clear domain boundaries.

============================================================

4. BACKEND MODULES

============================================================

Implement:

AuthModule

UsersModule

WalletModule

LedgerModule

GameModule

BetModule

PaymentModule

WithdrawalModule

KycModule

RiskModule

BonusModule

ResponsibleGamblingModule

NotificationModule

SupportModule

AdminModule

AuditModule

AnalyticsModule

Each module must have:

- Controllers

- Services

- DTOs

- Validation

- Database access

- Tests

- Error handling

Keep business logic out of controllers.

============================================================

5. DATABASE

============================================================

Use PostgreSQL.

Use UUID primary keys unless there is a strong reason otherwise.

Use:

NUMERIC(38,18)

for financial values.

NEVER use JavaScript floating-point numbers for financial settlement.

Core tables:

users

user_profiles

user_sessions

wallets

ledger_accounts

ledger_entries

deposits

withdrawals

payment_transactions

game_rounds

bets

cashouts

game_results

provably_fair_seeds

kyc_cases

risk_events

responsible_gambling_limits

bonus_campaigns

bonus_transactions

admin_users

admin_roles

permissions

role_permissions

audit_logs

support_tickets

support_messages

notifications

============================================================

6. USERS TABLE

============================================================

users:

id UUID PRIMARY KEY

email UNIQUE

password_hash

status

country_code

date_of_birth

email_verified_at

phone_verified_at

mfa_enabled

created_at

updated_at

last_login_at

Statuses:

PENDING_VERIFICATION

ACTIVE

RESTRICTED

SUSPENDED

SELF_EXCLUDED

CLOSED

============================================================

7. USER PROFILE

============================================================

user_profiles:

id

user_id

first_name

last_name

phone

address_line_1

address_line_2

city

postal_code

created_at

updated_at

Do not store unnecessary sensitive information.

============================================================

8. WALLET

============================================================

Create wallet records per user and currency.

wallets:

id

user_id

currency

available_amount

locked_amount

status

created_at

updated_at

Unique:

user_id + currency

The ledger is the financial source of truth.

Do NOT simply use:

users.balance

as the financial authority.

============================================================

9. DOUBLE-ENTRY LEDGER

============================================================

Implement an immutable accounting ledger.

ledger_accounts:

id

account_type

owner_type

owner_id

currency

created_at

ledger_entries:

id

transaction_id

account_id

entry_type

direction

amount

currency

reference_type

reference_id

metadata

created_at

Every balance-changing operation must create ledger entries.

Examples:

Deposit:

External Payment Account

        +

User Wallet

        +

Use proper accounting/debit-credit logic according to the internal ledger

model.

Bet:

User Wallet

        -

House/Game Account

        +

Win:

House/Game Account

        -

User Wallet

        +

Withdrawal:

User Wallet

        -

External Payment Account

        +

Ledger records must never be edited or deleted.

Corrections must use compensating transactions.

============================================================

10. DEPOSITS

============================================================

Support crypto deposits through an approved external payment provider.

Do NOT invent a fake blockchain integration.

Create a payment-provider abstraction:

PaymentProviderInterface

with implementations for approved providers.

Example:

CryptoProviderA

CryptoProviderB

The exact provider must be configurable.

Possible currencies:

USDT

USDC

BTC

ETH

Do not hard-code these.

The system must support configurable networks.

Deposit workflow:

USER

 ↓

Create Deposit

 ↓

Payment Provider

 ↓

Deposit Address / Payment Request

 ↓

Blockchain

 ↓

Provider Confirmation

 ↓

Signed Webhook

 ↓

Backend Verification

 ↓

Confirmation Requirements

 ↓

Ledger

 ↓

Wallet Balance

Never credit an account merely because the frontend says payment was sent.

Validate:

- Webhook signature

- Provider transaction ID

- Amount

- Currency

- Network

- Destination

- Confirmation status

- Timestamp

- Idempotency

Prevent duplicate webhook processing.

============================================================

11. DEPOSIT TABLE

============================================================

deposits:

id

user_id

wallet_id

provider

provider_transaction_id

currency

network

requested_amount

confirmed_amount

deposit_address

status

confirmations

required_confirmations

created_at

confirmed_at

metadata

Statuses:

CREATED

PENDING

CONFIRMING

CONFIRMED

FAILED

EXPIRED

CANCELLED

============================================================

12. WITHDRAWALS

============================================================

Create a secure withdrawal workflow.

User submits:

currency

network

amount

destination_address

Before processing:

- Account status

- KYC status

- Jurisdiction

- Balance

- Withdrawal limits

- Responsible gambling restrictions

- Bonus restrictions

- Risk checks

- AML checks

- MFA/step-up authentication where required

Workflow:

REQUESTED

 ↓

RISK_REVIEW

 ↓

APPROVED

 ↓

PROCESSING

 ↓

BROADCAST

 ↓

CONFIRMED

Possible final states:

REJECTED

FAILED

CANCELLED

CONFIRMED

Use balance reservation to prevent double spending.

============================================================

13. WITHDRAWAL TABLE

============================================================

withdrawals:

id

user_id

wallet_id

currency

network

amount

destination_address

provider

provider_transaction_id

status

risk_status

requested_at

approved_at

processed_at

completed_at

rejected_at

failure_reason

metadata

============================================================

14. CRASH GAME ENGINE

============================================================

The game engine must be server-authoritative.

Round states:

CREATED

BETTING

RUNNING

CRASHED

SETTLING

SETTLED

CANCELLED

State machine:

CREATED

   ↓

BETTING

   ↓

RUNNING

   ↓

CRASHED

   ↓

SETTLING

   ↓

SETTLED

Invalid transitions must be rejected.

A SETTLED round can never return to RUNNING.

============================================================

15. GAME ROUND

============================================================

game_rounds:

id

round_number UNIQUE

status

betting_open_at

betting_closed_at

started_at

crashed_at

settled_at

crash_multiplier

created_at

Each round must have a unique identifier.

Example:

RF-2026-000001

============================================================

16. PROVABLY FAIR

============================================================

Implement a cryptographically verifiable provably-fair system.

Use:

- Server seed

- Server seed hash

- Client seed

- Nonce

- Cryptographic HMAC/hash

- Versioned algorithm

Before the round:

Publish the server seed HASH.

After the appropriate reveal:

Reveal the server seed.

Users must be able to independently verify the result.

Store:

provably_fair_seeds:

id

round_id

server_seed_hash

server_seed_encrypted

client_seed

nonce

algorithm_version

revealed_at

created_at

The administrator must NOT be able to change an individual round's result.

Do NOT create:

- Force Win

- Force Lose

- Set Crash Point

- Manipulate Player

- Change Existing Result

The admin can configure legitimate global game parameters but cannot

manipulate individual outcomes.

============================================================

17. BETTING

============================================================

bets:

id

round_id

user_id

wallet_id

amount

currency

auto_cashout_multiplier

status

placed_at

cashout_at

cashout_multiplier

payout_amount

created_at

updated_at

Statuses:

PENDING

ACCEPTED

ACTIVE

CASHED_OUT

LOST

REFUNDED

CANCELLED

A bet can settle exactly once.

============================================================

18. CASHOUT

============================================================

Cashout must be server-side.

Endpoint:

POST /api/v1/game/bets/:betId/cashout

The client must NOT submit the authoritative cashout multiplier.

The server determines:

- Current multiplier

- Whether the round is still running

- Whether the bet is active

- Exact settlement time

- Payout

Handle race conditions carefully.

If crash and cashout happen concurrently, the server's authoritative event

ordering must determine the outcome according to the defined game-engine rules.

Test this extensively.

============================================================

19. REAL-TIME WEBSOCKET

============================================================

Use WebSocket for game events.

Connection:

/game

Events:

round.created

round.betting_open

round.betting_closed

round.started

multiplier.update

bet.accepted

bet.cashout

round.crashed

round.settled

Example:

{

  "event": "multiplier.update",

  "data": {

    "roundId": "uuid",

    "multiplier": "2.1834",

    "timestamp": 1786200000000

  }

}

The client only renders server events.

The client cannot control the game state.

============================================================

20. GAME HISTORY

============================================================

Provide:

GET /api/v1/game/rounds

Display:

Round Number

Crash Multiplier

Timestamp

Provably Fair Verification

Do not suggest that previous rounds predict future rounds.

============================================================

21. KYC

============================================================

Implement a KYC abstraction.

kyc_cases:

id

user_id

provider

provider_case_id

status

risk_level

submitted_at

reviewed_at

reviewer_id

rejection_reason

created_at

updated_at

Statuses:

NOT_STARTED

PENDING

APPROVED

REJECTED

REQUIRES_INFORMATION

Integrate with an approved KYC provider.

Do not store identity documents unnecessarily.

Encrypt sensitive information.

============================================================

22. JURISDICTION

============================================================

Create a jurisdiction service.

It must support:

- Restricted countries

- Restricted regions

- Geo checks

- VPN/proxy indicators

- Age verification

- Licensing configuration

A user who is not legally eligible must not be allowed to play for real money.

============================================================

23. RESPONSIBLE GAMBLING

============================================================

Implement:

Deposit limits

Loss limits

Session limits

Cooling-off periods

Self-exclusion

Account closure

Table:

responsible_gambling_limits:

id

user_id

deposit_daily_limit

deposit_weekly_limit

deposit_monthly_limit

loss_daily_limit

loss_weekly_limit

loss_monthly_limit

session_limit_minutes

cooling_off_until

self_exclusion_until

created_at

updated_at

Self-excluded users cannot bypass restrictions by normal account actions.

============================================================

24. RISK / AML

============================================================

Implement a risk engine.

risk_events:

id

user_id

event_type

risk_score

severity

status

source

description

metadata

created_at

resolved_at

resolved_by

Event types:

MULTIPLE_ACCOUNTS

VPN_DETECTED

UNUSUAL_WITHDRAWAL

RAPID_DEPOSIT_WITHDRAWAL

PAYMENT_ANOMALY

KYC_MISMATCH

HIGH_VALUE_ACTIVITY

DEVICE_CLUSTER

AML_REVIEW

Risk levels:

LOW

MEDIUM

HIGH

REVIEW_REQUIRED

Do not automatically accuse users of crimes based solely on risk signals.

Use risk signals to trigger appropriate review workflows.

============================================================

25. ADMIN RBAC

============================================================

Roles:

SUPER_ADMIN

FINANCE_ADMIN

KYC_ADMIN

RISK_ADMIN

SUPPORT_AGENT

ANALYST

READ_ONLY

Permissions must be granular.

Example:

Support Agent:

- View user

- View tickets

- Cannot approve withdrawals

- Cannot modify ledger

Finance Admin:

- View financial data

- Review withdrawals

- Approve according to policy

- Cannot modify game results

KYC Admin:

- Review KYC

- Approve/reject KYC

- Cannot modify wallet

Risk Admin:

- Review risk alerts

- Restrict accounts according to policy

- Cannot manipulate game outcomes

SUPER_ADMIN:

- Full operational administration

- Still cannot modify historical game outcomes

============================================================

26. ADMIN DASHBOARD

============================================================

Create:

/admin

Dashboard

Users

KYC

Finance

Game

Risk & AML

Promotions

Responsible Gambling

Support

Analytics

Audit Logs

Settings

Dashboard KPIs:

- Total Users

- Active Users

- Verified Users

- Depositors

- Active Bettors

- Total Deposits

- Total Withdrawals

- Total Wagered

- Total Payouts

- GGR

- NGR

- Pending KYC

- Pending Withdrawals

- Risk Alerts

- Active Game Rounds

Charts:

- Daily deposits

- Daily withdrawals

- Betting volume

- GGR

- NGR

- Active users

- New registrations

- Retention

- Average bet

- Average deposit

============================================================

27. ADMIN USERS

============================================================

Admin page:

/admin/users

Features:

- Search

- Filter

- Sort

- Pagination

- View account

- View KYC

- View wallet

- View ledger

- View bets

- View deposits

- View withdrawals

- View risk

- View responsible gambling

- Suspend

- Restrict

- Restore where appropriate

Never expose unnecessary sensitive information.

============================================================

28. ADMIN FINANCE

============================================================

/admin/finance

Sections:

Deposits

Withdrawals

Transactions

Ledger

Withdrawal filters:

- Pending

- Risk Review

- Approved

- Processing

- Completed

- Rejected

- Failed

Withdrawal detail:

User

KYC

Risk score

Amount

Currency

Network

Destination

Provider

Transaction ID

Deposit history

Withdrawal history

Betting history

Review history

High-value withdrawals can require:

Approval #1

↓

Approval #2

↓

Provider Processing

============================================================

29. ADMIN GAME

============================================================

/admin/game

Show:

Current Round

Round Number

Status

Players

Total Wagered

Current Multiplier

Server Health

WebSocket Connections

Configuration:

Minimum Bet

Maximum Bet

Maximum Payout

Maximum Exposure

Betting Duration

Supported Currencies

Algorithm Version

Configuration changes must:

- Be versioned

- Be audited

- Never modify historical rounds

NEVER provide administrator controls for:

Set Crash

Force Win

Force Lose

Manipulate User

============================================================

30. ADMIN RISK

============================================================

/admin/risk

Sections:

Alerts

High Risk Users

Reviews

Related Accounts

Transaction Monitoring

Risk review page:

User

Risk Score

Triggers

Transactions

Devices

Sessions

KYC

Deposit History

Withdrawal History

Betting Activity

Actions:

Review

Escalate

Restrict

Suspend

Resolve

Every action is audited.

============================================================

31. SUPPORT

============================================================

Users can create support tickets.

Categories:

Deposit Problem

Withdrawal Problem

Account Problem

KYC Problem

Technical Problem

Responsible Gambling

Other

Tables:

support_tickets

support_messages

Admin agents can:

- Assign

- Reply

- Change status

- Escalate

- Resolve

============================================================

32. NOTIFICATIONS

============================================================

Support:

Email

In-app notifications

Events:

Registration

Email Verification

KYC Submitted

KYC Approved

KYC Rejected

Deposit Created

Deposit Confirmed

Withdrawal Requested

Withdrawal Approved

Withdrawal Completed

Withdrawal Rejected

Security Alert

Password Changed

MFA Changed

Self Exclusion

============================================================

33. PROMOTIONS

============================================================

Create a configurable bonus engine.

Support:

Welcome Bonus

Deposit Bonus

Cashback

Free Bets

Every promotion must contain:

Eligibility

Maximum Bonus

Wagering Requirement

Expiration

Conversion Rules

Terms and Conditions

Do not advertise conditional bonuses as unconditional free money.

Bonus funds must be separate from cash funds where applicable.

============================================================

34. USER WEBSITE

============================================================

Public pages:

/

 /login

 /register

 /forgot-password

 /provably-fair

 /responsible-gambling

 /terms

 /privacy

 /faq

 /support

Authenticated:

/game

/wallet

/deposit

/withdraw

/transactions

/bets

/profile

/security

/kyc

/responsible-gambling

/support

============================================================

35. GAME UI

============================================================

Design:

Premium

Modern

Dark

Space/Rocket theme

Fast

Responsive

Mobile-first

Main game:

------------------------------------------------

ROCKET FLIGHT

Balance                         Deposit

------------------------------------------------

                    2.47x

                 🚀 ROCKET

            LIVE MULTIPLIER

------------------------------------------------

BET AMOUNT        AUTO CASHOUT

[ 10.00 ]         [ 2.00x ]

[             PLACE BET             ]

------------------------------------------------

Recent Results

1.23x   4.51x   1.08x   12.31x   2.44x

------------------------------------------------

Active Players

Player        Bet        Cashout

User123       20         2.31x

User456       5          1.72x

------------------------------------------------

The interface must clearly distinguish:

- Real Money

- Demo Mode

No fake social proof.

No fake players.

No fake wins.

============================================================

36. USER WALLET

============================================================

Wallet page:

Balance

Currency

Deposit

Withdraw

Transaction History

Transaction statuses:

Pending

Confirmed

Failed

Completed

Rejected

Use clear transaction IDs.

============================================================

37. USER SECURITY

============================================================

Security page:

Password

MFA

Active Sessions

Devices

Login History

Email

Withdrawal Security

Support step-up authentication for sensitive operations.

============================================================

38. API STRUCTURE

============================================================

Base:

/api/v1

Authentication:

POST /auth/register

POST /auth/login

POST /auth/logout

POST /auth/verify-email

POST /auth/forgot-password

POST /auth/reset-password

POST /auth/mfa/enable

POST /auth/mfa/verify

POST /auth/mfa/disable

User:

GET /users/me

PATCH /users/me

GET /users/me/sessions

DELETE /users/me/sessions/:id

Wallet:

GET /wallets

GET /wallets/:currency

GET /wallets/:currency/transactions

Deposits:

POST /deposits

GET /deposits

GET /deposits/:id

Withdrawals:

POST /withdrawals

GET /withdrawals

GET /withdrawals/:id

POST /withdrawals/:id/cancel

Game:

GET /game/round/current

GET /game/rounds

POST /game/bets

GET /game/bets

GET /game/bets/:id

POST /game/bets/:id/cashout

Fairness:

GET /fairness/round/:roundId

KYC:

POST /kyc

GET /kyc

GET /kyc/status

Responsible Gambling:

GET /responsible-gambling

PATCH /responsible-gambling/limits

POST /responsible-gambling/cooling-off

POST /responsible-gambling/self-exclusion

Support:

POST /support/tickets

GET /support/tickets

GET /support/tickets/:id

POST /support/tickets/:id/messages

Webhooks:

POST /webhooks/payments/:provider

POST /webhooks/kyc/:provider

============================================================

39. ADMIN API

============================================================

/api/v1/admin

Dashboard:

GET /dashboard/overview

GET /dashboard/revenue

GET /dashboard/gaming

GET /dashboard/risk

Users:

GET /users

GET /users/:id

PATCH /users/:id/status

GET /users/:id/activity

GET /users/:id/ledger

KYC:

GET /kyc

GET /kyc/:id

POST /kyc/:id/approve

POST /kyc/:id/reject

Withdrawals:

GET /withdrawals

GET /withdrawals/:id

POST /withdrawals/:id/approve

POST /withdrawals/:id/reject

POST /withdrawals/:id/escalate

Risk:

GET /risk/events

GET /risk/users/:id

POST /risk/events/:id/resolve

Game:

GET /game/rounds

GET /game/rounds/:id

GET /game/configuration

PATCH /game/configuration

Audit:

GET /audit-logs

Support:

GET /support/tickets

GET /support/tickets/:id

POST /support/tickets/:id/assign

============================================================

40. API SECURITY

============================================================

Every API endpoint must have:

- Authentication where required

- Authorization

- Validation

- Rate limiting

- Consistent errors

- Request IDs

- Logging

Financial endpoints require:

- Idempotency

- Database transaction

- Authorization

- Risk validation

Use:

Idempotency-Key

for financial requests.

Example:

POST /withdrawals

Headers:

Idempotency-Key: unique-request-id

============================================================

41. ERROR FORMAT

============================================================

Use:

{

  "success": false,

  "error": {

    "code": "INSUFFICIENT_BALANCE",

    "message": "Insufficient available balance.",

    "requestId": "req_123"

  }

}

Possible codes:

INVALID_REQUEST

UNAUTHORIZED

FORBIDDEN

ACCOUNT_RESTRICTED

SELF_EXCLUDED

KYC_REQUIRED

INSUFFICIENT_BALANCE

BET_LIMIT_EXCEEDED

ROUND_NOT_ACTIVE

BETTING_CLOSED

BET_ALREADY_SETTLED

WITHDRAWAL_LIMIT_EXCEEDED

RISK_REVIEW_REQUIRED

PAYMENT_FAILED

DUPLICATE_REQUEST

JURISDICTION_RESTRICTED

============================================================

42. AUDIT LOGGING

============================================================

Every sensitive admin operation must be logged.

audit_logs:

id

actor_id

actor_role

action

resource_type

resource_id

ip_address

user_agent

timestamp

metadata

Examples:

USER_SUSPENDED

KYC_APPROVED

WITHDRAWAL_APPROVED

WITHDRAWAL_REJECTED

GAME_CONFIG_CHANGED

ADMIN_LOGIN

ADMIN_MFA_CHANGED

RISK_EVENT_RESOLVED

Audit logs must be append-only.

============================================================

43. FINANCIAL INVARIANTS

============================================================

These are mandatory.

1. No unauthorized negative balances.

2. Every balance change has ledger entries.

3. Ledger entries are immutable.

4. Every financial request has an idempotency mechanism.

5. A deposit webhook can only credit once.

6. A withdrawal can only process once.

7. A bet can only settle once.

8. A payout can only settle once.

9. Client-side balance is never authoritative.

10. Client-side game result is never authoritative.

11. All financial operations are atomic.

12. All monetary calculations use exact decimal arithmetic.

============================================================

44. SECURITY

============================================================

Implement:

HTTPS

Secure HTTP-only cookies

SameSite protection

CSRF protection

CORS configuration

CSP

HSTS

XSS protection

SQL injection protection

Rate limiting

Brute-force protection

Argon2id

MFA

Secrets management

Encryption

Webhook signature verification

Replay protection

Idempotency

RBAC

Audit logging

Input validation

Output encoding

Never expose:

Private keys

Payment credentials

Raw server seeds before reveal

Internal secrets

Sensitive KYC data

Internal risk rules

============================================================

45. TESTING

============================================================

Write automated tests.

Unit tests:

- Wallet

- Ledger

- Bet validation

- Cashout

- Payout

- Provably fair

- Risk

- Limits

- KYC restrictions

Integration tests:

Deposit → Provider → Webhook → Ledger → Wallet

Bet → Ledger → Settlement

Win → Ledger → Wallet

Withdrawal → Reservation → Approval → Provider

KYC → Account Status

Risk → Withdrawal Review

Concurrency tests:

- 100 simultaneous cashouts

- Duplicate cashout

- Duplicate withdrawal

- Duplicate webhook

- Concurrent bets

- Crash/cashout race

- WebSocket reconnect

- Server restart during round

E2E test:

Register

→ Verify

→ KYC

→ Deposit

→ Place Bet

→ Cashout

→ View Transaction

→ Withdraw

============================================================

46. DEMO MODE

============================================================

Implement DEMO mode separately from REAL MONEY mode.

Demo:

- Virtual credits only

- Clearly labelled DEMO

- No withdrawal

- No conversion

- No real financial provider

- No real-money ledger

Real Money:

- KYC

- AML

- Jurisdiction checks

- Responsible gambling

- Payment provider

- Withdrawal controls

- Audit

- Risk controls

Never mix demo and real-money balances.

============================================================

47. CONFIGURATION

============================================================

Use environment variables.

Example:

NODE_ENV=

DATABASE_URL=

REDIS_URL=

SESSION_SECRET=

JWT_SECRET=

PAYMENT_PROVIDER_API_KEY=

PAYMENT_PROVIDER_WEBHOOK_SECRET=

KYC_PROVIDER_API_KEY=

KYC_PROVIDER_WEBHOOK_SECRET=

AML_PROVIDER_API_KEY=

SMTP_HOST=

SMTP_USER=

SMTP_PASSWORD=

SENTRY_DSN=

Never commit secrets to Git.

============================================================

48. DEPLOYMENT

============================================================

Architecture:

Internet

 ↓

Cloudflare / WAF

 ↓

Load Balancer

 ↓

Next.js

 ↓

NestJS API

 ↓

PostgreSQL

 ↓

Redis

 ↓

BullMQ

Maintain:

Development

Staging

Production

Never use production payment credentials in development.

Use database migrations.

Use automated backups.

Use health checks.

Use monitoring.

Use graceful shutdown.

============================================================

49. PERFORMANCE

============================================================

The game must support high-frequency multiplier updates without unnecessarily

overloading the database.

Do NOT write every visual multiplier update to PostgreSQL.

Use WebSocket/Redis for real-time game state.

Persist only authoritative events and required audit/settlement data.

Use Redis for:

- Current round

- Pub/sub

- WebSocket synchronization

- Temporary state

- Rate limiting

- Queues

PostgreSQL remains the durable source for financial and settlement data.

============================================================

50. FAILURE RECOVERY

============================================================

Design for:

API crash

Game engine crash

Redis failure

Database failure

WebSocket disconnect

Payment provider timeout

Duplicate webhook

Provider outage

Server restart during active round

The game engine must recover safely.

Financial operations must never be lost.

Do not settle a round twice.

Do not lose a player's bet.

Do not duplicate a payout.

============================================================

51. OBSERVABILITY

============================================================

Implement structured logging.

Every request should have:

requestId

userId where available

route

method

status

duration

Financial events require detailed audit logging.

Monitor:

API latency

Database latency

Redis health

WebSocket connections

Game engine health

Payment provider health

Failed deposits

Failed withdrawals

Risk alerts

Error rate

============================================================

52. UI/UX REQUIREMENTS

============================================================

Desktop and mobile responsive.

Dark premium space/rocket design.

Use smooth but lightweight animations.

Prioritize:

- Fast interaction

- Clear balances

- Clear bet state

- Clear crash state

- Clear cashout state

- Clear transaction status

- Accessibility

- Mobile usability

Do not use deceptive UX.

Do not use fake activity.

Do not use fake winning notifications.

Do not create misleading claims such as:

"Guaranteed Win"

"Almost Guaranteed"

"Predict the Next Crash"

"100% Profit"

============================================================

53. DATABASE INDEXING

============================================================

Create indexes for:

users.email

users.status

users.country_code

wallets.user_id

wallets.currency

ledger_entries.account_id

ledger_entries.transaction_id

ledger_entries.reference_id

ledger_entries.created_at

deposits.user_id

deposits.status

deposits.provider_transaction_id

withdrawals.user_id

withdrawals.status

withdrawals.provider_transaction_id

game_rounds.round_number

game_rounds.status

game_rounds.created_at

bets.user_id

bets.round_id

bets.status

bets.created_at

risk_events.user_id

risk_events.status

risk_events.created_at

audit_logs.actor_id

audit_logs.resource_id

audit_logs.created_at

============================================================

54. DATABASE CONSTRAINTS

============================================================

Use:

Foreign keys

Unique constraints

Check constraints

Not-null constraints

Transaction isolation where appropriate

Prevent:

Duplicate provider transaction IDs.

Duplicate round numbers.

Duplicate ledger transaction IDs.

Duplicate webhook processing.

Duplicate withdrawal processing.

============================================================

55. FINAL PROJECT OUTPUT

============================================================

Do NOT immediately dump thousands of lines of code.

Build the project systematically.

PHASE 1:

Architecture

PHASE 2:

Database schema + Prisma

PHASE 3:

Authentication

PHASE 4:

User management

PHASE 5:

Wallet

PHASE 6:

Immutable ledger

PHASE 7:

Demo game engine

PHASE 8:

Provably-fair engine

PHASE 9:

WebSocket real-time engine

PHASE 10:

Betting + cashout

PHASE 11:

KYC

PHASE 12:

Responsible gambling

PHASE 13:

Risk/AML

PHASE 14:

Payment-provider abstraction

PHASE 15:

Crypto deposit integration

PHASE 16:

Withdrawal system

PHASE 17:

Admin dashboard

PHASE 18:

Analytics

PHASE 19:

Support

PHASE 20:

Security hardening

PHASE 21:

Automated testing

PHASE 22:

Deployment

For each phase:

1. Explain what is being built.

2. Show the architecture.

3. Show the files that will be created.

4. Implement the code.

5. Add database migrations where required.

6. Add validation.

7. Add error handling.

8. Add tests.

9. Explain environment variables.

10. Explain how to run it.

11. Check the implementation for security problems.

12. Do not claim something is production-ready if it is still a placeholder.

============================================================

56. DEVELOPMENT RULES

============================================================

Write clean, maintainable TypeScript.

Use strict TypeScript.

Avoid any unnecessary "any" types.

Use dependency injection.

Separate business logic from HTTP controllers.

Use DTO validation.

Use transactions for financial operations.

Use repository/service patterns where useful.

Do not duplicate business logic.

Do not hard-code secrets.

Do not hard-code payment credentials.

Do not create fake blockchain confirmations.

Do not create fake KYC approvals.

Do not create fake withdrawals.

Do not create hidden administrator backdoors.

Do not create administrator controls that manipulate individual game results.

============================================================

57. FIRST TASK

============================================================

Do NOT start by creating the frontend.

Start with PHASE 1.

Produce:

1. Complete system architecture.

2. Complete folder structure.

3. Complete database ERD.

4. Complete PostgreSQL/Prisma schema design.

5. Complete module architecture.

6. API architecture.

7. Authentication architecture.

8. Wallet architecture.

9. Ledger architecture.

10. Game-engine architecture.

11. Provably-fair architecture.

12. Payment-provider abstraction.

13. KYC/AML architecture.

14. Risk architecture.

15. Admin RBAC architecture.

16. WebSocket architecture.

17. Security architecture.

18. Deployment architecture.

19. Testing architecture.

20. Development roadmap.

Then STOP.

Do not skip directly to later phases.

After PHASE 1 is reviewed, proceed to PHASE 2.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0245f45e-e124-45b7-a415-d8b890adb629).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
