# CiPD Campus Ambassador Dashboard

## Project purpose

This repository contains a demo dashboard for managing CiPD campus ambassador campaigns. Ambassadors register, connect a social profile, join campaigns, submit campaign posts, and track ratings and awards. Administrators create campaigns, verify reported metrics, and review rankings and analytics.

## Technology and project structure

- `frontend/` — Next.js 16 and React 19 application. Route groups under `src/app/admin/` and `src/app/ambassador/` provide role-specific dashboards; shared authenticated requests use `src/lib/api.ts`.
- `backend/` — FastAPI application and SQLAlchemy queries in `main.py`, dependencies in `requirements.txt`, database bootstrap in `schema.sql`, and an interactive admin-password utility in `set_admin_password.py`.
- PostgreSQL — stores users, ambassador profiles, social accounts, campaigns, post submissions, metric snapshots, ratings, and awards.

## Application workflow

Registration creates a user and an ambassador profile. Login verifies the Argon2 password hash and returns a JWT. Protected routes validate that token and enforce the `ADMIN` or `AMBASSADOR` role; ambassador-owned resources are resolved from the authenticated user rather than a client-supplied user ID.

New ambassadors begin as `PENDING`. They become `ACTIVE` after at least one social account is marked verified, and return to `PENDING` if their last verified account is disconnected. Only active ambassadors participate in scoring, ranking, and awards.

Administrators create campaigns with platform, schedule, and content requirements. An eligible ambassador can submit a campaign-post URL for a connected, verified platform. The post remains pending until an administrator records and verifies reach, likes, comments, shares, saves, and views. The application then normalizes reach and engagement within each platform, weights them 30% and 70%, averages multiple post scores, assigns campaign rank and percentile, and awards three to five stars from that percentile. Stored ratings power awards, leaderboards, and analytics; analytics uses the latest metric snapshot for each post. Ambassadors can also maintain their own profile details.

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
- The frontend API URL and backend CORS origins target local development (`localhost`/`127.0.0.1`). Configure both explicitly before deployment.
- The JWT is currently stored in browser `localStorage`. A production deployment should use a hardened session strategy, such as secure, HTTP-only cookies with appropriate CSRF protection.
- Social access tokens must remain server-side and must never be returned to the frontend, logged, or committed.
