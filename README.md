# CiPD Campus Ambassador Dashboard

## Project purpose

This repository contains a demo dashboard for managing CiPD campus ambassador campaigns. Ambassadors register with email and mobile contact details, connect a social profile, join campaigns, submit campaign posts, and track ratings and awards. Administrators configure the programme WhatsApp group link, create campaigns, contact ambassadors, export the ambassador directory, verify reported metrics, and review rankings and analytics.

## Technology and project structure

- `frontend/` — Next.js 16 and React 19 application. Route groups under `src/app/admin/` and `src/app/ambassador/` provide role-specific dashboards; shared authenticated requests use `src/lib/api.ts`.
- `backend/` — FastAPI application and SQLAlchemy queries in `main.py`, email outbox/scheduling in `notifications.py` and `scheduler.py`, dependencies in `requirements.txt`, database bootstrap in `schema.sql`, additive upgrades in `migrations/`, and an interactive admin-password utility in `set_admin_password.py`.
- PostgreSQL — stores users, ambassador profiles, social accounts, campaigns, post submissions, metric snapshots, ratings, and awards.

## Application workflow

Registration creates a user and an ambassador profile. Login verifies the Argon2 password hash and returns a JWT. Protected routes validate that token and enforce the `ADMIN` or `AMBASSADOR` role; ambassador-owned resources are resolved from the authenticated user rather than a client-supplied user ID.

New ambassadors begin as `PENDING`. They become `ACTIVE` after at least one social account is marked verified, and return to `PENDING` if their last verified account is disconnected. Only active ambassadors participate in scoring, ranking, and awards.

Administrators create campaigns with platform, schedule, and content requirements. An eligible ambassador can submit a campaign-post URL for a connected, verified platform. The post remains pending until an administrator records and verifies reach, likes, comments, shares, saves, and views. The application then normalizes reach and engagement within each platform, weights them 30% and 70%, averages multiple post scores, assigns campaign rank and percentile, and awards three to five stars from that percentile. Stored ratings power awards, leaderboards, and analytics; analytics uses the latest metric snapshot for each post. Ambassadors can also maintain their own profile details.

Registration remains open with or without a WhatsApp link. After an ambassador's first successful login, the system queues one welcome email with onboarding and submission steps; it includes the admin-configured group invite when available. Campaign creation queues exactly one email per registered ambassador for that newly listed campaign, containing its official URL and guidelines. Administrators can also queue a one-time announcement for all ambassadors. A background worker sends queued mail when SMTP delivery is enabled. On the first day of each month, it queues each ambassador's previous-month verified metrics and a top-10 benchmark based on the existing normalized leaderboard, including platform-level metrics. Unique database keys prevent duplicate welcome, campaign, or monthly emails.

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

Email delivery is disabled by default. To enable it, set `EMAIL_DELIVERY_ENABLED=true` and configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, and, when required, `SMTP_USERNAME` and `SMTP_PASSWORD`. Keep those values only in `.env`. `PUBLIC_FRONTEND_URL` controls links included in campaign emails.

For an existing database created before contact details and notifications were added, apply the additive migration once:

```powershell
psql -U postgres -d cipd_ambassadors -f migrations\20260916_contacts_notifications.sql
psql -U postgres -d cipd_ambassadors -f migrations\20260917_broadcasts.sql
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

Sign in as an administrator and open **Settings** to save the official `https://chat.whatsapp.com/...` group invite link or email all ambassadors. Registration stays open when the link is absent. Ambassadors can view the current link under **How It Works**.

## Useful validation commands

```powershell
# Backend syntax/import check (run inside backend with the venv active)
python -c "import main; print(main.health())"

# Frontend checks (run inside frontend)
npm run lint
npm run build
```

## Prototype limitations

- Social account linking is a manual prototype and does not perform real OAuth authorization.
- Social metrics are entered and verified manually by an administrator; no platform metrics API is connected.
- The admin supplies the optional group invite URL under **Settings**. An ambassador receives it in the one-time welcome email only when it is available at first login and can always view the latest link under **How It Works**. The portal cannot silently add the person to a group. The separate WhatsApp action opens a direct chat with a prefilled greeting, and the admin must press Send.
- Campaign and monthly emails are real SMTP-backed jobs only after valid SMTP settings are supplied. Failed deliveries are retained for review and limited retries; no credentials are included in the repository.
- The frontend API URL and backend CORS origins target local development (`localhost`/`127.0.0.1`). Configure both explicitly before deployment.
- The JWT and user profile are stored in browser `sessionStorage`, separately for each tab/window. You can sign in as admin in one window and ambassador in another; refreshing preserves each login, and logging out affects only that window. A fresh window requires sign-in, and token expiry still applies. After upgrading from the old shared storage, sign in again once in each window. This storage is still accessible to JavaScript; a production deployment should use a hardened session strategy, such as secure, HTTP-only cookies with appropriate CSRF protection.
- Social access tokens must remain server-side and must never be returned to the frontend, logged, or committed.
