# Money Autopsy

Money Autopsy turns bank or PhonePe statements into private, searchable spending reports. Its main workflow is statement import, merchant normalization, transaction review, monthly reports, and month-to-month comparisons. Manual transaction entry is not required.

## Stack and capabilities

- Next.js App Router, React, and TypeScript
- PostgreSQL with Prisma ORM 7
- HTTP-only JWT session cookies
- CSV and supported text-based PDF statement parsing
- Deterministic merchant normalization, user rules, and spending classifications
- Monthly reports, spending patterns, recurring-payment suggestions, and natural-language search
- Optional, opt-in OpenAI report explanations using aggregate report facts

## Get started

1. Use Node.js 22 and create a PostgreSQL database.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL` and a private random `AUTH_SECRET` of at least 32 characters.
3. Install dependencies with `npm install`.
4. Apply the checked-in migrations and generate Prisma Client with `npx prisma migrate dev`.
5. Start the app with `npm run dev`.

Imports are limited to 10 MB. CSV files need a header row with date, description (or details/merchant), and amount columns. Date and time, type (credit/debit), and status columns are recognized when present. Selectable-text PDF tables with supported date, description, and amount columns are parsed; scanned PDFs and unsupported layouts are rejected. Imported transactions use the account's merchant mappings, categories, and spending rules. Statement contents are processed in memory and are not stored as uploaded files.

To enable the optional AI explanation, set `OPENAI_API_KEY` and `OPENAI_MODEL`. The user must opt in before requesting an explanation. The request contains aggregate report facts and disables provider-side response storage; financial totals always come from the database.

Run verification with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Database isolation tests run only when `TEST_DATABASE_URL` points to a dedicated test database. CI starts PostgreSQL, deploys migrations, and runs that test.

For a local container deployment, set `AUTH_SECRET` (and optional AI variables) in the environment, then run `docker compose up --build`. Compose starts PostgreSQL, applies migrations, and serves the app on port 3000. This does not provision a production service or production database.

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/register`, `/login` | Account access |
| `/dashboard` | This month's spending overview |
| `/imports` | Upload and review imports |
| `/transactions` | Search, filter, and categorize transactions |
| `/transactions/:id` | Inspect and edit a transaction |
| `/reports/:year/:month` | Monthly Money Autopsy |
| `/compare` | Compare spending between months |
| `/search` | Search using plain-language filters |
| `/settings/categories` | Manage categories and classifications |
| `/settings/merchants` | Correct merchant mappings and defaults |
| `/settings/notifications` | Configure in-app notifications |
| `/settings/rules` | User-specific merchant and category rules |

## Project map

```text
app/
  (auth)/              Login and registration pages
  (dashboard)/         Authenticated product pages
  api/                 Route handlers with server-side session checks
  page.tsx             Public landing page
lib/
  analytics/           Monthly reports, comparisons, and patterns
  merchants/           Merchant normalization and categorization
  parsers/             CSV and PDF statement parsers
  auth.ts              Password hashing and sessions
prisma/
  schema.prisma        PostgreSQL data model
  migrations/          Checked-in database migrations
tests/                 Unit tests and optional database isolation test
```

Money Autopsy — Development README

Purpose: This file is the single source of truth for developing Money Autopsy.

Any AI coding assistant reading this file should:

Read the current phase and checklist.

Work only on the next incomplete task unless the user explicitly asks for something else.

After successfully implementing and verifying a task, change its checkbox from - [ ] to - [x].

Never mark a task complete just because code was written. It must be implemented and verified.

Do not skip ahead to later phases unless the user asks.

Do not rebuild working features unnecessarily.

Preserve the existing architecture and learnings.

If something is blocked, explain the blocker instead of falsely checking the task.

1. Product Goal

Money Autopsy lets a user normally use PhonePe/banking services and then upload a transaction statement at the end of the month.

The application should:

Upload statement
      ↓
Process transactions
      ↓
Recognize merchants
      ↓
Categorize transactions
      ↓
Calculate analytics
      ↓
Compare months
      ↓
Generate Money Autopsy

The core product does not require AI.

Natural-language search and an optional AI report explanation are available. The AI explanation is not required for any calculation.

2. Core Product Rules

No manual expense entry for the main workflow.

CSV importing comes before PDF importing.

PostgreSQL is the primary database.

Prisma is the ORM.

Merchant normalization should learn from user corrections/rules.

Financial numbers must come from backend/database calculations.

AI must never invent financial numbers.

Spending classifications are user-controlled.

Never assume a purchase is objectively "useless."

Never trust userId sent by the browser; derive the authenticated user server-side.

Never commit secrets such as DATABASE_URL, AUTH_SECRET, storage credentials, or API keys.

3. Development Status

Phase 0 — Project Foundation

Project structure confirmed

Frontend runs locally

Backend/API runs locally

PostgreSQL connection works

Prisma connection works

Environment variables configured

Git repository initialized

Basic README/project documentation maintained

Phase 0 exit condition

The application can run locally and communicate with PostgreSQL through Prisma.

4. Phase 1 — Authentication

Goal

Users can create an account, log in, log out, and access their own data.

Tasks

Create User model

Add name

Add unique email

Add passwordHash

Add createdAt

Create registration API

Create login API

Create logout API

Create current-user (/me) API

Hash passwords securely

Implement authentication/session mechanism

Protect authenticated routes

Create /register

Create /login

Redirect authenticated users to /dashboard

Verify user A cannot access user B's data

API

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

Phase 1 exit condition

A new user can register, log in, remain authenticated, log out, and only access their own data.

5. Phase 2 — Database Foundation

Goal

Create the core relational data model.

Models

User
 ├── Transaction
 ├── Import
 ├── Merchant
 ├── Category
 ├── SpendingRule
 └── MonthlyReport

Tasks

Create User

Create Import

Create Transaction

Create Merchant

Create Category

Create SpendingRule

Add required relationships

Add appropriate indexes

Add unique constraints where required

Run Prisma migrations

Generate Prisma client

Verify CRUD operations

Verify user-level data isolation

Transaction fields

id
userId
importId
merchantId
categoryId
amount
type
description
transactionDate
transactionTime
createdAt

Phase 2 exit condition

The database can safely store users, imports, transactions, merchants, categories, and user-specific rules.

6. Phase 3 — Dashboard

Goal

Create the main screen users see after logging in.

Tasks

Create /dashboard

Display selected/current month

Display total spent

Display comparison with previous month

Display category totals

Display spending-over-time data

Display biggest money leak

Display small-purchase summary

Add loading states

Add empty states

Add error states

Example:

September 2026

Total Spent
₹18,420

↑ 21.4% vs August

Food        ₹4,850
Shopping    ₹3,200
Travel      ₹2,180

Phase 3 exit condition

A logged-in user can open the dashboard and see accurate analytics from their own stored transactions.

7. Phase 4 — CSV Import

Goal

Allow users to upload a CSV statement and automatically create transactions.

Tasks

Create /imports

Add CSV upload UI

Create import API

Validate file type

Validate file size

Parse CSV

Validate CSV rows

Normalize transaction data

Detect income/expense

Save Import record

Save transactions

Show processing status

Show imported transaction count

Show income total

Show expense total

Add import error handling

Add duplicate/import protection where appropriate

Processing pipeline

CSV
 ↓
File validation
 ↓
Parse
 ↓
Validate rows
 ↓
Normalize transaction
 ↓
Find merchant
 ↓
Apply user rules
 ↓
Assign category
 ↓
Save PostgreSQL
 ↓
Recalculate analytics

Phase 4 exit condition

A user can upload a valid CSV and see the imported transactions in the application.

8. Phase 5 — Merchant Intelligence

Goal

Convert inconsistent transaction descriptions into normalized merchants.

Example:

UPI/ZOMATO-123456
UPI-Zomato-Pay
ZOMATO ONLINE
        ↓
     Zomato
        ↓
      Food

Tasks

Create merchant normalization logic

Store raw transaction description

Store normalized merchant

Create merchant records

Match known merchants

Allow manual merchant correction

Persist corrected merchant mappings

Apply mappings to future imports

Add merchant management API

Add merchant UI

API

GET   /api/merchants
PATCH /api/merchants/:id

Phase 5 exit condition

The same merchant appearing in different statement formats is normalized consistently, and user corrections persist.

9. Phase 6 — Categories

Goal

Automatically categorize transactions while allowing users to correct them.

Initial categories

Food
Shopping
Travel
Entertainment
Subscriptions
Bills
Education
Health
Personal
Cash
Other

Tasks

Create category system

Add default categories

Assign categories during import

Create custom category

Edit category

Delete category where safe

Change transaction category

Persist category corrections

Support user-specific categories

API

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

Phase 6 exit condition

Transactions receive categories and users can change them.

10. Phase 7 — Transactions

Goal

Create a searchable and editable transaction table.

Tasks

Create /transactions

Display date

Display merchant

Display category

Display amount

Display income/expense type

Add search

Add month filter

Add category filter

Add merchant filter

Add amount filter

Add income/expense filter

Create transaction detail view

Allow category changes

Allow safe transaction editing

Add pagination if required

API

GET    /api/transactions
GET    /api/transactions/:id
PATCH  /api/transactions/:id
DELETE /api/transactions/:id

Phase 7 exit condition

A user can search, filter, inspect, and modify their own transactions.

11. Phase 8 — Analytics

Goal

Calculate useful financial statistics from transactions.

Tasks

Monthly total spent

Monthly total income

Money remaining

Category totals

Merchant totals

Most frequent merchants

Most expensive transactions

Small-purchase totals

Biggest spending categories

Biggest spending changes

Monthly comparison

API

GET /api/analytics/summary
GET /api/analytics/categories
GET /api/analytics/merchants
GET /api/analytics/patterns
GET /api/analytics/recurring
GET /api/analytics/monthly-comparison

Phase 8 exit condition

Analytics are calculated from real database data and match manually verified calculations.

12. Phase 9 — Money Autopsy Report

Goal

Create the application's main monthly report.

Route:

/reports/:month

Sections

Financial snapshot

Where money went

Biggest spending areas

Small purchase damage

Most frequent merchants

Most expensive transactions

Month-over-month changes

Clear numerical explanations

Example:

September 2026

Money received   ₹25,000
Money spent      ₹18,420
Money remaining   ₹6,580

Phase 9 exit condition

A user can open a month and receive a complete, accurate Money Autopsy report.

13. Phase 10 — Month Comparison

Goal

Compare two months.

Route:

/compare

Tasks

Select first month

Select second month

Compare category totals

Calculate absolute changes

Calculate percentage changes where appropriate

Identify largest increase

Identify largest decrease

Handle missing months/categories

Verify calculations

Example:

Category        August     September     Change
Food            ₹3,610      ₹4,850       +₹1,240
Shopping        ₹2,500      ₹3,200         +₹700
Travel          ₹2,600      ₹2,180         -₹420

Phase 10 exit condition

Two selected months can be compared accurately.

14. Phase 11 — Spending Patterns

Goal

Detect patterns using deterministic backend rules. No AI required.

Patterns

Frequent small purchases

Late-night spending

Weekend spending

Repeated merchant

Recurring payment

Rules

Small purchase:
amount < configured threshold

Late night:
transaction time > 10 PM

Repeated merchant:
same merchant 3+ times/month

Weekend:
Saturday or Sunday

Recurring:
similar merchant
+ similar amount
+ similar date
+ repeated across months

Phase 11 exit condition

The backend detects patterns from transaction data and the UI displays them with the underlying numbers.

15. Phase 12 — Recurring Payments

Goal

Detect recurring payments automatically.

Example:

Spotify
₹119
Aug 10
Sep 10
Oct 10

↓

Likely recurring payment
Spotify — ₹119/month

Tasks

Detect repeated merchants

Compare similar amounts

Compare transaction dates

Calculate recurrence confidence/rules

Display recurring payments

Avoid claiming certainty when the data only suggests a recurring payment

Phase 12 exit condition

Repeated subscription-like transactions are surfaced as likely recurring payments.

16. Phase 13 — User-Controlled Spending Classification

Goal

Do not decide whether spending is "useless."

The user controls the classification.

Classifications

Essential
Useful
Discretionary
Custom

Tasks

Add classification field

Allow user to classify merchants/transactions

Create user-specific rules

Persist rules

Apply rules during imports

Display classification totals

Allow rules to override generic defaults

Example:

Zomato       → Discretionary
Amazon       → Useful
College Bus  → Essential

Phase 13 exit condition

The application reflects the user's own spending classifications.

17. Phase 14 — User-Specific Rules

Route:

/settings/rules

Tasks

Create rules UI

Create rule API

Edit rules

Delete rules

Apply rules during import

Store rules per user

Test conflicting rules

Test rule precedence

Example:

Merchant: Zomato
Category: Food
Classification: Discretionary

API/data concept

SpendingRule
 ├── userId
 ├── pattern
 ├── merchantId
 ├── categoryId
 └── classification

Phase 14 exit condition

A user's rules consistently affect future imports.

18. Phase 15 — PDF Import

Goal

Support bank/PhonePe PDF statements after CSV importing is stable.

Tasks

Add PDF upload UI

Validate PDF file

Parse supported PDF formats

Extract transaction rows

Validate extracted data

Normalize transactions

Run merchant matching

Apply categories

Apply user rules

Save transactions

Handle malformed PDFs

Clearly report unsupported formats

Phase 15 exit condition

Supported PDFs can be imported reliably without breaking CSV imports.

19. Phase 16 — Security Hardening

Because this application processes financial information, security is a first-class requirement.

Tasks

Password hashing

Authentication

Authorization

Server-side user identification

Input validation

File type validation

File size limits

Rate limiting

Secure cookies/session handling

Environment variables

Database access restrictions

User data isolation tests

Error messages do not leak secrets

Secrets excluded from Git

Critical rule

Never trust:

userId from browser

Instead:

authenticated session
        ↓
server identifies user
        ↓
query only that user's data

Phase 16 exit condition

Security-sensitive flows have been tested and user data is isolated.

20. Phase 17 — Natural-Language Search

Goal

Let users filter their own transactions with plain-language queries.

Tasks

Parse transaction type, amount, date, category, and merchant constraints deterministically

Scope every search to the authenticated user

Validate query length and rate-limit requests

Display the parsed interpretation and matching transactions

Verify the supported query parsing rules

Phase 17 exit condition

Natural-language queries produce understandable, user-scoped transaction results.

21. Phase 18 — Optional AI Report Explanation

Goal

Offer an opt-in written explanation without delegating financial calculations to AI.

Tasks

Require explicit user consent

Send aggregate report facts without raw transaction descriptions

Disable provider-side response storage

Reject generated financial amounts and malformed responses

Keep AI optional when provider credentials are absent

Phase 18 exit condition

AI can explain report trends while all financial numbers remain database-calculated.






1.  Phase 19 — Monthly Report Generation

Tasks

Generate complete monthly report

Include financial snapshot

Include categories

Include patterns

Include recurring payments

Include month comparison

Include user classifications

Generate concise explanation

Verify all numerical values

Phase 19 exit condition

A user can generate a complete monthly Money Autopsy.

23. Phase 20 — Notifications

Tasks

Decide notification mechanism

Monthly statement reminder

Report-ready notification

Optional recurring-payment notification

User notification settings

Rate limiting/notification safeguards

Phase 20 exit condition

Notifications are useful, configurable, and do not spam users.

24. Phase 21 — Deployment

Target architecture

GitHub
   │
   ├── Frontend / Next.js
   │
   └── Backend / API
            │
            ↓
        PostgreSQL

Possible deployment services can include:

Frontend → Vercel
Backend  → Railway / Render / other suitable service
Database → Managed PostgreSQL

Tasks

Production environment configuration

Production database

Production migrations

Production frontend

Production API

Secure environment variables

CORS configuration

The product uses same-origin route handlers; no separate API host is configured.

Authentication in production


Statement files are processed in memory and are not persisted, so production file storage is not required.

Logging

Error monitoring

Health check

Deployment documentation

Production smoke test

Required environment concepts

DATABASE_URL=
AUTH_SECRET=
STORAGE_URL=
STORAGE_KEY=

Never commit real secret values.

Phase 21 exit condition

The application is deployed and a complete user flow works in production.

25. Phase 22 — Testing

Testing should happen continuously, but this phase is for final coverage.

Tasks

Authentication tests

Database tests

Import parser tests

Merchant normalization tests

Category tests

Analytics tests

Month comparison tests

Recurring-payment tests

Authorization tests

File validation tests

API error tests

Frontend critical-flow tests

Production smoke tests

Important test

Create two users and verify:

User A → only User A transactions
User B → only User B transactions

26. Phase 23 — Final Product Polish

Tasks

Landing page polished

Dashboard polished

Import experience polished

Transaction table polished

Report polished

Comparison page polished

Loading states

Empty states

Error states

Responsive design

Accessibility basics

Mobile layout

Performance review

Remove dead code

Remove unused dependencies

Update README

Update environment documentation

27. Master Progress Checklist

An AI should use this section to determine the current project phase.

[x] Phase 0  — Project Foundation
[x] Phase 1  — Authentication
[x] Phase 2  — Database Foundation
[x] Phase 3  — Dashboard
[x] Phase 4  — CSV Import
[x] Phase 5  — Merchant Intelligence
[x] Phase 6  — Categories
[x] Phase 7  — Transactions
[x] Phase 8  — Analytics
[x] Phase 9  — Money Autopsy Report
[x] Phase 10 — Month Comparison
[x] Phase 11 — Spending Patterns
[x] Phase 12 — Recurring Payments
[x] Phase 13 — Spending Classification
[x] Phase 14 — User-Specific Rules
[x] Phase 15 — PDF Import
[ ] Phase 16 — Security Hardening
[x] Phase 17 — Natural-Language Search
[x] Phase 18 — Optional AI Report Explanation
[ ] Phase 19 — Monthly Report Generation
[ ] Phase 20 — Notifications
[ ] Phase 21 — Deployment
[ ] Phase 22 — Testing
[ ] Phase 23 — Final Product Polish

Completion notes

Phases 16, 19, and 20 include database-backed verification in `tests/database-isolation.test.ts`; run it with a dedicated `TEST_DATABASE_URL`. It is skipped when that variable is absent. The CI workflow provisions PostgreSQL and applies migrations before running the test.

Phase 21 has Docker and Compose deployment files, a migration step, and a database health check, but a production deployment and smoke test still need a target service and its credentials.

Phases 22 and 23 still need authentication/API authorization and browser-flow coverage, plus a manual accessibility and performance review.

The npm audit reports four high advisories in Prisma CLI's transitive `deepmerge-ts` and `mysql2` dependencies. Prisma CLI is a development dependency and is absent from the standalone runtime. npm only offered a forced downgrade to Prisma 6, so no automatic downgrade was applied.

1.  AI Working Protocol

When an AI assistant starts working on this repository:

Step 1 — Inspect

First inspect:

README.md
package.json
project structure
environment configuration
database schema
current git status
current application state

Do not assume the checklist is accurate without checking the repository.

Step 2 — Find the current phase

Find the first incomplete phase in the Master Progress Checklist.

Then inspect the individual tasks inside that phase.

Step 3 — Choose the next task

Work on the smallest logical incomplete task.

Example:

Phase 4
[x] Create imports page
[x] Create upload API
[ ] Parse CSV
[ ] Validate CSV rows

The next task is:

Parse CSV

Do not jump to PDF parsing or AI.

Step 4 — Implement

Make the smallest appropriate change.

Avoid unnecessary rewrites.

Step 5 — Verify

Run the relevant:

typecheck
lint
tests
build
database migration
manual verification

Use the commands appropriate to the actual repository.

Step 6 — Update the checklist

Only after successful verification:

- [ ] Parse CSV
+ [x] Parse CSV

Also update the Master Progress Checklist when the entire phase is complete.

Step 7 — Report

Tell the user:

Completed:
- Parse CSV

Verified:
- Test/build/check performed

Next:
- Validate CSV rows

29. Rules for AI Agents

DO

Read the README before making changes.

Inspect existing code before creating new code.

Follow the current phase.

Reuse existing components/services.

Keep database migrations safe.

Verify changes.

Update checkboxes only after verification.

Explain blockers.

Keep the user in control of architectural decisions.

Preserve working functionality.

DON'T

Don't mark incomplete work as complete.

Don't claim tests passed without running them.

Don't invent project files or APIs.

Don't replace the architecture without a reason.

Don't add AI just because it is available.

Don't add Redux/state libraries without a real need.

Don't add PDF parsing before CSV importing is stable.

Don't trust browser-provided userId.

Don't expose secrets.

Don't delete working code without confirmation when the change is destructive.

Don't implement future phases just because they look interesting.

30. Definition of Done

A task is DONE only when:

Implementation exists
        +
Relevant verification passed
        +
Existing functionality still works
        +
No known blocker remains
        +
README checkbox updated

If any of these are missing:

DO NOT CHECK THE BOX.

31. Current Next Task

The AI must determine this from the repository rather than blindly trusting this section.

Current phase:
[ ] Phase 16 — Security Hardening (first incomplete phase)

Current task:
[ ] Run database isolation and report-calculation tests with a dedicated TEST_DATABASE_URL; the suite is configured in CI but skipped locally without this variable.
[ ] Add and run authentication API, authorization, and critical frontend-flow tests.

After completing it:
→ verify it
→ check the task
→ check the phase only when every task in that phase is complete
→ continue to the next phase

32. Product North Star

The finished experience should feel like:

Use PhonePe normally
        ↓
End of month
        ↓
Open Money Autopsy
        ↓
Upload statement
        ↓
Processing
        ↓
"Your September Money Autopsy is ready"
        ↓
See:
  - Where money went
  - Biggest spending areas
  - Small purchases
  - Frequent merchants
  - Recurring payments
  - Spending patterns
  - Month-to-month changes
        ↓
Understand your spending

The core idea is:

No manual expense tracking. Import your statement. Understand where your money actually went.
