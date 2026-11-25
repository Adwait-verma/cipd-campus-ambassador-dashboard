# CiPD Campus Ambassador Dashboard

## Project purpose

This repository contains a demo dashboard for managing CiPD campus ambassador campaigns. Ambassadors register with email and mobile contact details, connect an Instagram Business/Creator account, join campaigns, submit campaign posts, and track ratings and awards. Administrators configure the programme WhatsApp group link, create campaigns, contact ambassadors, export the ambassador directory, verify reported metrics, and review rankings and analytics.

## Technology and project structure

- `frontend/` — Next.js 16 and React 19 application. Route groups under `src/app/admin/` and `src/app/ambassador/` provide role-specific dashboards; shared authenticated requests use `src/lib/api.ts`.
- `backend/` — FastAPI application and SQLAlchemy queries in `main.py`, email outbox/scheduling in `notifications.py` and `scheduler.py`, dependencies in `requirements.txt`, database bootstrap in `schema.sql`, additive upgrades in `migrations/`, and an interactive admin-password utility in `set_admin_password.py`.
- PostgreSQL — stores users, ambassador profiles, social accounts, campaigns, post submissions, metric snapshots, ratings, and awards.

## Application workflow

Registration creates a user and an ambassador profile. Login verifies the Argon2 password hash and returns a JWT. Protected routes validate that token and enforce the `ADMIN` or `AMBASSADOR` role; ambassador-owned resources are resolved from the authenticated user rather than a client-supplied user ID. Forgotten passwords use a single-use email link that expires after 30 minutes. Only a SHA-256 hash of the reset token is stored, and a successful reset keeps the user on the normal sign-in path. Reset requests are limited to three attempts per email in 15 minutes and 20 attempts per client IP in one hour; the stored email/IP identifiers are keyed hashes rather than readable values.

New ambassadors begin as `PENDING`. They become `ACTIVE` after their Instagram account is marked verified, and return to `PENDING` if Instagram is disconnected. Only active ambassadors participate in scoring, ranking, and awards.

Administrators create campaigns with platform, schedule, and content requirements. An eligible ambassador can submit a campaign-post URL from their connected, verified Instagram account. The post remains pending until complete Instagram metrics are received automatically; manual verification remains an admin recovery action for independently checked metrics. The application then normalizes Instagram reach and engagement, weights them 30% and 70%, averages multiple post scores, assigns campaign rank and percentile, and awards three to five stars from that percentile. Stored ratings power awards, leaderboards, and analytics; analytics uses the latest metric snapshot for each post. Ambassadors can also maintain their own profile details.

Registration remains open with or without a WhatsApp link. Registration queues one welcome email with onboarding and submission steps; it includes the admin-configured group invite when available. The first successful login also queues a missing welcome email for accounts created before this change. This is one message per account, not one per login. Before publishing a campaign, the admin sees the subject, message, and recipient count; confirmation then creates the campaign and queues exactly one email per registered ambassador. Administrators can also queue a one-time announcement for everyone or a selected ambassador. A background worker sends queued mail when SMTP delivery is enabled. On the first day of each month, it queues each ambassador's previous-month verified metrics and a top-10 benchmark based on the existing normalized leaderboard, including platform-level metrics. Unique database keys prevent duplicate welcome, campaign, or monthly emails.

## Windows setup

### Prerequisites

Install Python 3.10 or newer, PostgreSQL (including the `psql` and `createdb` command-line tools), and Node.js 20.9 or newer. Run the following commands in PowerShell from a local checkout.

### 1. Create the PostgreSQL database and schema

```powershell
createdb -U postgres cipd_ambassadors
psql -U postgres -d cipd_ambassadors -f backend\schema.sql
```

These commands prompt for PostgreSQL credentials instead of placing them in shell history. If the CLI tools are not on `PATH`, create the `cipd_ambassadors` database in pgAdmin and run `backend/schema.sql` with its Query Tool.

### 2. Configure and start the FastAPI backend

```powershell
cd backend
py -3.10 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item env.example .env
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

If PowerShell blocks activation, first run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. Edit the new local `.env` to configure `DATABASE_URL` for the database above and set `JWT_SECRET` to the generated value. Never commit `.env` or reuse a demo secret in production.

Email delivery is disabled by default. To enable it, set `EMAIL_DELIVERY_ENABLED=true` and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and, when required, `SMTP_USERNAME` and `SMTP_PASSWORD`. Set `SMTP_USE_TLS` according to your mail provider's instructions. For Gmail SMTP, use a Google app password, not the normal account password. A WhatsApp invite link does not configure mail delivery. Keep credentials only in `.env` and restart FastAPI after editing it. To prevent automatic sending of old queued messages during a demo, set `EMAIL_AUTOSEND_AFTER` to a timezone-aware timestamp such as `2026-09-18T14:21:35+05:30`; earlier messages remain queued for deliberate admin review. **Admin → Settings → Email delivery** shows pending, sent, failed, and held-older counts. **Send all pending now** includes older mail after confirmation. `PUBLIC_FRONTEND_URL` controls links included in emails. Do not put SMTP passwords in chat, screenshots, or Git.

Before enabling delivery, run `python check_email.py` to test SMTP authentication, then `python check_email.py --send-self` to send one message only to the sender mailbox. These checks do not touch the queued ambassador emails. Enable delivery and restart FastAPI only after both succeed.

For an existing database created before contact details and notifications were added, apply the additive migration once:

```powershell
psql -U postgres -d cipd_ambassadors -f migrations\20260916_contacts_notifications.sql
psql -U postgres -d cipd_ambassadors -f migrations\20260917_broadcasts.sql
psql -U postgres -d cipd_ambassadors -f migrations\20260918_admin_contact.sql
psql -U postgres -d cipd_ambassadors -f migrations\20260919_help_and_password_reset.sql
psql -U postgres -d cipd_ambassadors -f migrations\20260920_admin_activity_rate_limits.sql
```

To assign a password to an existing administrator, run:

```powershell
python set_admin_password.py
```

The script prompts for an existing admin email and a hidden new password, confirms that the user has the `ADMIN` role, hashes the password with the configured Argon2 implementation, and updates only that account. It contains no embedded credentials or secrets.

Start the API:

```powershell
uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`; interactive documentation is at `http://127.0.0.1:8000/docs`.

### 3. Configure and start the Next.js frontend

Open a second PowerShell window from the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. For a production-mode local check, run `npm run build` followed by `npm run start`.

Sign in as an administrator and open **Settings & Email** to save the official `https://chat.whatsapp.com/...` group invite link, set the programme help email/phone, or email all or one current ambassador. The help contact is visible to ambassadors under **Help & Contact** and does not change the login email or SMTP sender. Registration stays open without a group link. After saving a new link, preview and confirm an invitation email for existing current members; departed members are excluded. Repeated submission of the same confirmation does not duplicate messages. Delivery counts refresh every five seconds while the page is visible.

### Programme and campaign management


Existing databases must apply `backend/migrations/20261125_programme_management.sql` before running this version. Fresh databases use the updated schema directly. The migration retains all existing records.

- Ambassadors can leave under **Profile → Programme membership**. Their account, posts, metrics and historical ratings remain stored. Status becomes `LEFT`; programme mail stops, queued programme mail is cancelled, and new submissions/social connections are blocked. An email already handed to the mail provider cannot be recalled. Explicitly requested password-reset/security emails remain available. Leaving the WhatsApp group is a separate action in WhatsApp.
- Administrators can filter departed ambassadors with **Left** and restore membership from their profile after a rejoining request. Restoring derives ACTIVE/PENDING from verified social accounts and does not resend cancelled mail.
- Open a campaign to edit its details, close submissions, archive it, or reopen it. These actions retain submissions and ratings and do not automatically send another campaign announcement. Archived/closed campaigns remain available for historical review.
- A campaign displays **Metrics updated—recalculation needed** when verified snapshots are newer than its last calculation, with a direct recalculation action for live campaigns. Changed Instagram metrics also trigger automatic calculation. The campaign scoring formula is unchanged.
- **Activity Log** supports administrator, action and inclusive India-time date filters, with 25 records per page. Logs omit passwords, tokens and email bodies.

Run PostgreSQL workflow integration tests against a test-capable database by setting `CIPD_TEST_DATABASE_URL` and running `python -m unittest discover -s backend/tests -v`. These tests create a temporary schema inside a transaction and roll it back; SMTP is mocked. Never put connection credentials in Git.

### Instagram OAuth setup (required for Instagram connections)

Instagram connections use real OAuth (Instagram API with Instagram Login), not a manual prototype. To enable it:

1. Create an app at [developers.facebook.com](https://developers.facebook.com), add the **Instagram** product, and configure **Business Login for Instagram** to get an App ID and App Secret.
2. Instagram only accepts **HTTPS** redirect URIs, so for local development run an HTTPS tunnel (for example `ngrok http 8000`) and register `https://<your-tunnel-domain>/ambassador/social-accounts/instagram/callback` as the redirect URI. Also add the bare tunnel domain under **App settings > Basic > App Domains**.
3. While the app is in Development Mode, add each ambassador's Instagram account as an **Instagram Tester** in the App Dashboard and accept the invite from inside the Instagram app. This needs no app review for a small pilot group; going live for a wider audience requires Meta app review.
4. Ambassadors must connect a **Business or Creator** Instagram account. Personal accounts cannot use this login flow; switching is free and reversible from the Instagram app.
5. Fill in `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI` and `FRONTEND_URL` in `backend/.env`, and generate `TOKEN_ENCRYPTION_KEY` with:
   ```powershell
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
6. As an admin, open an ambassador's profile and use **Sync now** on a submitted Instagram post to pull its real reach, likes, comments, shares, saves and views. The post must have been published from the connected Business/Creator account. Changed metrics automatically trigger campaign rating calculation using the existing formula.

The Instagram authorization implementation is maintained separately by the integration owner. The portal's expiry warnings only read saved metadata; they do not change OAuth permissions, token exchange, token refresh or the existing connection flow. Confirm app settings with that owner before a live connection test.

The core OAuth, token encryption, token refresh and media-resolution functions match official commit `167de8a`. `tests/test_authentication_baseline.py` checks their syntax-tree hashes. Portal membership checks and safe redirect messages are separate route wrappers in `workflows.py`; scheduled HTTP budgeting uses an isolated adapter in `service_adapters.py`, without changing the original helpers or globally patching their HTTP client.

For the local OAuth test, keep three terminals running: FastAPI on 8000, Next.js on 3000, and `ngrok http 8000` after configuring the ngrok agent. Use the same full HTTPS callback URL in Meta and `INSTAGRAM_REDIRECT_URI`. Set `FRONTEND_URL=http://localhost:3000` and open the portal on that exact origin so the tab's login session survives the round trip. If the tunnel URL changes, update both redirect settings and restart FastAPI. ngrok exposes the callback; the backend fetches metrics directly from Instagram, not through the tunnel. Tester setup is for development; wider public access requires the applicable Meta review and access level. See [Meta's media-insights requirements](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media/insights).

### Automatic Instagram updates and reports

For existing databases, apply `backend/migrations/20261125_instagram_schedule.sql` after the programme-management migration. Fresh databases already include these tables. From the repository root:

```powershell
psql -U postgres -d cipd_ambassadors -f backend\migrations\20261125_programme_management.sql
psql -U postgres -d cipd_ambassadors -f backend\migrations\20261125_instagram_schedule.sql
```

Restart FastAPI after installing migrations or editing `.env`.

- Active members' Instagram posts in open, currently running campaigns have a 60-minute refresh target, with small timing offsets. The scheduler checks every minute, processes at most 20 posts per batch, and recalculates each affected campaign once after the batch. It also recovers calculations interrupted after metrics were saved. Manual recalculation first refreshes connected Instagram submissions not successfully synced within five minutes; it waits if refresh fails.
- **Settings & Email → Instagram updates** and each admin ambassador profile show last successful sync, next attempt, connection failures, API pauses and report preparation. **Sync now** shares the same budgets and retry cooldowns.
- Missing, rejected or incomplete API responses never replace stored metrics with zeros. Genuine measured zeros are valid. Successful changes update one API snapshot per post per India calendar day; prior days and manual snapshots remain intact. Unchanged values only update sync status, avoiding needless rating calculations.
- Previous-month reports are prepared on startup and checked every 15 minutes. Before queuing them, the system refreshes connected Instagram posts for campaigns represented in that month's submissions, for still-open campaigns, then recalculates their ratings. Ended campaigns use their fixed pre-closing results. An unavailable connection or exhausted budget holds the reports for retry; no report is sent until preparation succeeds. Previously queued unsent reports are refreshed; sent reports are not resent. Report metrics are cumulative values for posts published in the selected month, refreshed during preparation, **not** an exact month-end snapshot or a measure of monthly growth. Only Instagram participates; legacy platform records remain in the database but are hidden from active portal views.
- Defaults in `backend/env.example`: `INSTAGRAM_SYNC_INTERVAL_MINUTES=60`, `INSTAGRAM_SYNC_BATCH_SIZE=20`, local safety budgets of 180 app calls/hour and 60 account calls/hour, one-second request spacing, and a pause at 70% reported Meta usage. These are conservative application settings, **not Meta quota guarantees**. One already-resolved post normally needs two calls; initial permalink lookup and token refresh need extra calls. Large cohorts or throttling can exceed the hourly target. Keep the API running for scheduled work.
- [Meta's rate-limit documentation](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/) describes Instagram Platform quotas per app/user pair over a rolling 24-hour window, based on impressions, and separate Platform limits. Actual capacity depends on the app, token and endpoint; confirm it in the Meta dashboard. The sync worker monitors `X-App-Usage` and `X-Business-Use-Case-Usage`, honors recovery/`Retry-After` delays, and records reservations/cooldowns in PostgreSQL so workers share the budget. Adjust the configurable budgets only after observing the real app's usage.


### Instagram-only rankings and closing policy

Apply the additional migration after the two November workflow/scheduling migrations:

```powershell
psql -U postgres -d cipd_ambassadors -f backend\migrations\20261125_instagram_rankings.sql
```

- **Admin → Awards** and **Ambassador → Performance** each offer overall and campaign views. The ambassador dashboard and monthly top-10 benchmark use the same overall score.
- A live campaign retains the existing 30% reach / 70% engagement normalization and post-average formula. Equal campaign scores use ambassador ID as a deterministic ordering; no scoring weights change.
- At the end of the campaign's end date in **Asia/Kolkata**, metric collection stops. The next background pass calculates and stores the final ranking using complete verified Instagram measurements captured before that cutoff. It does not fetch later growth to recreate a past closing measurement. A missing measurement never creates a zero award. If the server was offline at closing, finalisation catches up using the stored pre-closing data.
- Final ranks, scores, stars and scored metrics are immutable, including after a participant disconnects or leaves. A closed result cannot be reopened/rescored by changing its dates. Corrections need a separately designed, audited policy; create a new campaign for a new round. Campaign titles, instructions and archive status remain editable.
- Overall score is the equal-weight average of each current ACTIVE ambassador's scored campaign results. Reach, engagements and post counts are summed across those same results. Unscored campaigns are omitted rather than assigned zero; participation count is displayed. Equal overall scores share rank. Frozen campaign cohorts remain intact while departed members leave the current overall cohort.
- Overall views aggregate indexed stored results; they do not fetch Instagram data or recalculate every campaign on page load. One snapshot is saved per ended campaign. This keeps the additional work bounded for a campus programme.
- **Awards** and **Performance** contain a collapsed **How updates and rankings work** section with the configured refresh target, normally **60 minutes**. General pages have no repeated sync banner. This is a target, not a guaranteed delivery interval. Operational connection/setup details remain in **Settings & Email**.
- **Ambassador → Profile → Instagram connection expiry** shows the saved expiry date, a warning within seven days, expired/unknown access status, and a link to the existing Instagram reconnect page. **Admin → Settings & Email → Connection expiry warnings** lists current members needing renewal. The list refreshes every minute and when the page regains focus; departed members are excluded. The warning endpoints make no requests to Instagram and return no access tokens. They do not send additional emails or alter renewal behavior.
- **Help & Contact** displays only the public programme email/phone saved under **Admin → Settings & Email**, with refresh while open. It does not publish a private login email or SMTP account automatically.

## Useful validation commands

```powershell
# Backend syntax/import check (run inside backend with the venv active)
python -c "import main; print(main.health())"
python -m unittest discover -s tests -v

# Frontend checks (run inside frontend)
npm run lint
npm run build
```

## Prototype limitations

- The portal currently supports Instagram only, using real OAuth and the Instagram Graph API (Business/Creator accounts only; Development Mode requires each ambassador to be added as a Tester). Existing non-Instagram records are retained for history but do not appear in portal metrics, eligibility, submissions or rankings. New non-Instagram connections/submissions are rejected.
- Automatic metrics require a working OAuth connection, app configuration and token-encryption key. An admin may verify independently checked Instagram metrics as a recovery action while the campaign is open.
- The admin supplies the optional group invite URL under **Settings**. An ambassador receives it in the one-time welcome email only when it is available at registration and can always view the latest link under **How It Works**. The portal cannot silently add the person to a group. The separate WhatsApp action opens a direct chat with a prefilled greeting, and the admin must press Send.
- Campaign and monthly emails are real SMTP-backed jobs only after valid SMTP settings are supplied. Failed deliveries are retained for review and limited retries; no credentials are included in the repository.
- The frontend API URL and backend CORS origins target local development (`localhost`/`127.0.0.1`). Configure both explicitly before deployment.
- The JWT and user profile are stored in browser `sessionStorage`, separately for each tab/window. You can sign in as admin in one window and ambassador in another; refreshing preserves each login, and logging out affects only that window. A fresh window requires sign-in, and token expiry still applies. After upgrading from the old shared storage, sign in again once in each window. This storage is still accessible to JavaScript; a production deployment should use a hardened session strategy, such as secure, HTTP-only cookies with appropriate CSRF protection.
- Social access tokens must remain server-side and must never be returned to the frontend, logged, or committed.
