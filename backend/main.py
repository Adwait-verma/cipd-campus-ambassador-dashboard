"""
CiPD Ambassador Rating System — Backend

Run:
    uvicorn main:app --reload
"""
import base64
import os
import re
import csv
import io
import hashlib
import hmac
import json
import secrets
import time
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote, urlencode, urlparse

import jwt
import requests
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, EmailStr
from pwdlib import PasswordHash
from sqlalchemy import create_engine, text

from notifications import (
    automatic_email_cutoff,
    deliver_pending,
    email_enabled,
    email_ready,
    missing_email_settings,
    campaign_email_body,
    campaign_email_subject,
    portal_url,
    queue_campaign_notifications,
    queue_broadcast,
    queue_password_changed_email,
    queue_password_reset_email,
    queue_welcome_email,
)
from scheduler import start_scheduler

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is not set in the .env file.")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not set — copy .env.example to .env and fill in your password"
    )

engine = create_engine(DATABASE_URL)
password_hash = PasswordHash.recommended()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    scheduler = start_scheduler(engine)
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="CiPD Ambassador Rating System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Instagram OAuth (Instagram API with Instagram Login — Business/Creator
# accounts only; Meta shut down the old Basic Display API in Dec 2024).
# ---------------------------------------------------------------------------
INSTAGRAM_APP_ID = os.getenv("INSTAGRAM_APP_ID")
INSTAGRAM_APP_SECRET = os.getenv("INSTAGRAM_APP_SECRET")
INSTAGRAM_REDIRECT_URI = os.getenv("INSTAGRAM_REDIRECT_URI")
FRONTEND_URL = (
    os.getenv("FRONTEND_URL")
    or os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000")
).rstrip("/")
TOKEN_ENCRYPTION_KEY = os.getenv("TOKEN_ENCRYPTION_KEY")

# How long an ambassador has to finish the Instagram consent screen
# before the signed state we handed them stops being accepted.
OAUTH_STATE_TTL_SECONDS = 600


def _get_fernet() -> Fernet:
    if not TOKEN_ENCRYPTION_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "TOKEN_ENCRYPTION_KEY is not set in the .env file. "
                "Generate one with: python -c \"from cryptography.fernet "
                "import Fernet; print(Fernet.generate_key().decode())\""
            ),
        )
    try:
        return Fernet(TOKEN_ENCRYPTION_KEY.encode())
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="TOKEN_ENCRYPTION_KEY is invalid.",
        )


def encrypt_token(raw_token: str) -> str:
    """Social access tokens are never stored in plaintext (see schema.sql)."""
    return _get_fernet().encrypt(raw_token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    try:
        return _get_fernet().decrypt(encrypted_token.encode()).decode()
    except InvalidToken:
        raise HTTPException(
            status_code=500,
            detail="Stored access token could not be decrypted.",
        )


def create_oauth_state(user_id: int) -> str:
    """
    Signs a short-lived, tamper-proof value carrying the ambassador's
    user_id through the Instagram redirect round-trip. A browser
    redirect can't carry our normal Authorization header, so this
    signed state is what authenticates the callback instead.
    """
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps({
            "user_id": user_id,
            "nonce": secrets.token_urlsafe(12),
            "issued_at": int(time.time()),
        }).encode()
    ).decode()

    signature = hmac.new(
        JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def verify_oauth_state(state: str) -> int:
    try:
        payload_b64, signature = state.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    expected_signature = hmac.new(
        JWT_SECRET.encode(), payload_b64.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=400, detail="Invalid OAuth state signature."
        )

    try:
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid OAuth state.")

    if time.time() - payload["issued_at"] > OAUTH_STATE_TTL_SECONDS:
        raise HTTPException(
            status_code=400,
            detail="OAuth session expired. Please try connecting again.",
        )

    return int(payload["user_id"])


def get_valid_instagram_token(ambassador_id: int, conn) -> str:
    """
    Returns a live Instagram access token for this ambassador,
    transparently refreshing the long-lived token if it's close to
    expiring (Instagram long-lived tokens last ~60 days).
    """
    row = conn.execute(
        text("""
            SELECT access_token, token_expires_at
            FROM social_accounts
            WHERE ambassador_id = :ambassador_id
              AND platform = 'INSTAGRAM'
              AND verified = TRUE
        """),
        {"ambassador_id": ambassador_id},
    ).fetchone()

    if not row or not row._mapping["access_token"]:
        raise HTTPException(
            status_code=404,
            detail="No verified Instagram account connected for this ambassador.",
        )

    access_token = decrypt_token(row._mapping["access_token"])
    expires_at = row._mapping["token_expires_at"]

    if expires_at and expires_at - datetime.now(timezone.utc) < timedelta(days=5):
        try:
            refresh_response = requests.get(
                "https://graph.instagram.com/refresh_access_token",
                params={
                    "grant_type": "ig_refresh_token",
                    "access_token": access_token,
                },
                timeout=15,
            )
            refresh_response.raise_for_status()
            refresh_data = refresh_response.json()
            access_token = refresh_data["access_token"]

            conn.execute(
                text("""
                    UPDATE social_accounts
                    SET access_token = :access_token,
                        token_expires_at = :token_expires_at,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE ambassador_id = :ambassador_id
                      AND platform = 'INSTAGRAM'
                """),
                {
                    "access_token": encrypt_token(access_token),
                    "token_expires_at": datetime.now(timezone.utc)
                    + timedelta(seconds=refresh_data.get("expires_in", 60 * 24 * 60 * 60)),
                    "ambassador_id": ambassador_id,
                },
            )
        except requests.RequestException:
            # Refresh failed — fall back to the still-valid existing token
            # rather than failing the whole request.
            pass

    return access_token


def _normalize_permalink(url: str) -> str:
    # Instagram's "Copy Link" share action appends a ?stkn=... tracking
    # token that isn't present in the canonical permalink the Graph API
    # returns, so strip query string/fragment before comparing.
    return url.split("?")[0].split("#")[0].rstrip("/")


def resolve_instagram_media_id(access_token: str, post_url: str) -> str:
    """
    The Graph API only returns media the authenticated professional
    account owns, and only by internal media ID — there's no endpoint
    to resolve a public post URL to that ID directly. We page through
    the account's own media and match on permalink.
    """
    normalized_target = _normalize_permalink(post_url)
    url = "https://graph.instagram.com/me/media"
    params = {
        "fields": "id,permalink",
        "access_token": access_token,
        "limit": 50,
    }

    for _ in range(10):  # cap pagination so a bad match can't loop forever
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()

        for item in data.get("data", []):
            if _normalize_permalink(item.get("permalink", "")) == normalized_target:
                return item["id"]

        next_page = data.get("paging", {}).get("next")
        if not next_page:
            break

        url = next_page
        params = None  # "next" URL already includes all query params

    raise HTTPException(
        status_code=404,
        detail=(
            "Could not find this post on the connected Instagram account. "
            "The submitted URL must match a post published from the "
            "connected professional account."
        ),
    )


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization token is required.",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header.",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )

        user_id = payload.get("sub")
        role = payload.get("role")

        if not user_id or not role:
            raise HTTPException(
                status_code=401,
                detail="Invalid token.",
            )

        return {
            "user_id": int(user_id),
            "role": role,
            "email": payload.get("email"),
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Session expired. Please sign in again.",
        )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token.",
        )


def require_admin(
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    return current_user


def require_ambassador(
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "AMBASSADOR":
        raise HTTPException(
            status_code=403,
            detail="Ambassador access required.",
        )

    return current_user


def require_own_user_id(user_id: int, current_user: dict):
    if user_id != current_user["user_id"]:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another ambassador's data.",
        )



class ProfileUpdateRequest(BaseModel):
    full_name: str
    email: EmailStr
    college_name: str
    graduation_year: int
    phone_number: str | None = None

def normalize_phone_number(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    phone = re.sub(r"[\s()-]", "", value)
    if re.fullmatch(r"[6-9]\d{9}", phone):
        phone = "+91" + phone
    if not re.fullmatch(r"\+[1-9]\d{7,14}", phone):
        raise HTTPException(
            status_code=400,
            detail=(
                "Enter a valid mobile number with country code "
                "(for example, +91 followed by 10 digits)."
            ),
        )
    return phone


def log_admin_activity(
    conn,
    current_user: dict,
    action: str,
    summary: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
):
    conn.execute(text("""
        INSERT INTO admin_activity_logs (
            admin_user_id, action, entity_type, entity_id, summary
        )
        VALUES (
            :admin_user_id, :action, :entity_type, :entity_id, :summary
        )
    """), {
        "admin_user_id": current_user["user_id"],
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "summary": summary,
    })


def privacy_preserving_rate_limit_hash(kind: str, value: str) -> str:
    return hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"{kind}:{value.strip().lower()}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class CampaignCreateRequest(BaseModel):
    title: str
    description: str | None = None
    mandatory_hashtag: str | None = None
    target_url: str | None = None
    start_date: date
    end_date: date
    is_active: bool = True
class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    college_name: str
    graduation_year: int
    password: str
    phone_number: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
class MetricVerificationRequest(BaseModel):
    reach_count: int = 0
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    saves_count: int = 0
    views_impressions: int = 0

class AdminSettingsRequest(BaseModel):
    whatsapp_group_invite_url: str


class AdminContactRequest(BaseModel):
    contact_email: EmailStr | None = None
    phone_number: str | None = None


class BroadcastRequest(BaseModel):
    subject: str
    message: str
    recipient_user_id: int | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    password: str


@app.get("/admin/contact")
def get_admin_contact(current_user: dict = Depends(require_admin)):
    with engine.connect() as conn:
        login_email = conn.execute(text("""
            SELECT email FROM users
            WHERE user_id = :user_id AND role = 'ADMIN'
        """), {"user_id": current_user["user_id"]}).scalar()
        contact = conn.execute(text("""
            SELECT support_contact_email, support_phone_number
            FROM portal_settings WHERE settings_id = 1
        """)).fetchone()
    if login_email is None:
        raise HTTPException(status_code=404, detail="Admin account not found.")
    return {
        "email": login_email,
        "contact_email": contact.support_contact_email if contact else None,
        "phone_number": contact.support_phone_number if contact else None,
    }


@app.put("/admin/contact")
def update_admin_contact(
    data: AdminContactRequest,
    current_user: dict = Depends(require_admin),
):
    phone_number = normalize_phone_number(data.phone_number)
    with engine.begin() as conn:
        login_email = conn.execute(text("""
            SELECT email FROM users
            WHERE user_id = :user_id AND role = 'ADMIN'
        """), {"user_id": current_user["user_id"]}).scalar()
        if login_email is None:
            raise HTTPException(status_code=404, detail="Admin account not found.")
        row = conn.execute(text("""
            INSERT INTO portal_settings (
                settings_id, support_contact_email, support_phone_number
            )
            VALUES (1, :contact_email, :phone_number)
            ON CONFLICT (settings_id) DO UPDATE SET
                support_contact_email = EXCLUDED.support_contact_email,
                support_phone_number = EXCLUDED.support_phone_number
            RETURNING support_contact_email, support_phone_number
        """), {
            "contact_email": str(data.contact_email) if data.contact_email else None,
            "phone_number": phone_number,
        }).fetchone()
        log_admin_activity(
            conn,
            current_user,
            "HELP_CONTACT_UPDATED",
            "Updated the ambassador help email and phone number.",
            "portal_settings",
            1,
        )
    return {
        "email": login_email,
        "contact_email": row.support_contact_email,
        "phone_number": row.support_phone_number,
    }


@app.get("/ambassador/help-contact")
def get_ambassador_help_contact(
    current_user: dict = Depends(require_ambassador),
):
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT support_contact_email, support_phone_number
            FROM portal_settings WHERE settings_id = 1
        """)).fetchone()
    return {
        "contact_email": row.support_contact_email if row else None,
        "phone_number": row.support_phone_number if row else None,
    }


@app.get("/admin/settings")
def get_admin_settings(current_user: dict = Depends(require_admin)):
    with engine.connect() as conn:
        invite_url = conn.execute(text("""
            SELECT whatsapp_group_invite_url FROM portal_settings
            WHERE settings_id = 1
        """)).scalar()
    return {"whatsapp_group_invite_url": invite_url or ""}


@app.get("/ambassador/whatsapp-group")
def get_ambassador_whatsapp_group(
    current_user: dict = Depends(require_ambassador),
):
    with engine.connect() as conn:
        invite_url = conn.execute(text("""
            SELECT whatsapp_group_invite_url FROM portal_settings
            WHERE settings_id = 1
        """)).scalar()
    return {"whatsapp_group_invite_url": invite_url or None}


@app.put("/admin/settings")
def update_admin_settings(
    data: AdminSettingsRequest,
    current_user: dict = Depends(require_admin),
):
    submitted_url = data.whatsapp_group_invite_url.strip()
    invite_url = None
    if submitted_url:
        parsed = urlparse(submitted_url)
        if (
            parsed.scheme != "https"
            or parsed.netloc.lower() != "chat.whatsapp.com"
            or not re.fullmatch(r"/[A-Za-z0-9]+/?", parsed.path)
        ):
            raise HTTPException(
                status_code=400,
                detail="Enter a valid https://chat.whatsapp.com/ invite link.",
            )
        invite_url = f"https://chat.whatsapp.com/{parsed.path.strip('/')}"
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO portal_settings (settings_id, whatsapp_group_invite_url)
            VALUES (1, :url)
            ON CONFLICT (settings_id) DO UPDATE
            SET whatsapp_group_invite_url = EXCLUDED.whatsapp_group_invite_url
        """), {"url": invite_url})
        log_admin_activity(
            conn,
            current_user,
            "WHATSAPP_LINK_UPDATED",
            "Updated the programme WhatsApp group invite link."
            if invite_url else "Removed the programme WhatsApp group invite link.",
            "portal_settings",
            1,
        )
    return {"whatsapp_group_invite_url": invite_url or ""}


@app.get("/admin/notifications/status")
def get_notification_status(current_user: dict = Depends(require_admin)):
    cutoff = automatic_email_cutoff()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT kind, status, COUNT(*)::INT AS count
            FROM email_outbox GROUP BY kind, status
        """)).fetchall()
        older_queued = conn.execute(text("""
            SELECT COUNT(*)::INT FROM email_outbox
            WHERE :cutoff IS NOT NULL
              AND created_at < CAST(:cutoff AS TIMESTAMPTZ)
              AND status IN ('PENDING', 'FAILED', 'SENDING')
        """), {"cutoff": cutoff}).scalar_one()
    return {
        "delivery_enabled": email_enabled(),
        "smtp_configured": not missing_email_settings(),
        "delivery_ready": email_ready(),
        "missing_settings": missing_email_settings(),
        "older_queued": older_queued,
        "counts": [dict(row._mapping) for row in rows],
    }


@app.post("/admin/notifications/send-pending")
def send_pending_notifications(current_user: dict = Depends(require_admin)):
    if not email_ready():
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured.",
        )
    result = deliver_pending(engine, include_older=True)
    with engine.begin() as conn:
        log_admin_activity(
            conn,
            current_user,
            "PENDING_EMAILS_SENT",
            f"Triggered pending email delivery: {result['sent']} sent, {result['failed']} failed.",
            "email_outbox",
        )
    return result


@app.post("/admin/notifications/broadcast")
def broadcast_to_ambassadors(
    data: BroadcastRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
):
    subject = data.subject.strip()
    message = data.message.strip()
    if not subject or not message or len(subject) > 200 or len(message) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Enter a subject (up to 200 characters) and message (up to 5000 characters).",
        )
    with engine.begin() as conn:
        invite_url = conn.execute(text("""
            SELECT whatsapp_group_invite_url FROM portal_settings
            WHERE settings_id = 1
        """)).scalar()
        queued = queue_broadcast(
            conn,
            subject,
            message,
            invite_url,
            data.recipient_user_id,
        )
        if data.recipient_user_id is not None and queued == 0:
            raise HTTPException(
                status_code=404,
                detail="The selected ambassador could not be found.",
            )
        destination = (
            f"ambassador user #{data.recipient_user_id}"
            if data.recipient_user_id is not None
            else "all registered ambassadors"
        )
        log_admin_activity(
            conn,
            current_user,
            "EMAIL_ANNOUNCEMENT_QUEUED",
            f"Queued '{subject}' for {destination} ({queued} message(s)).",
            "email_broadcast",
        )
    if queued and email_ready():
        background_tasks.add_task(deliver_pending, engine)
    return {"queued": queued, "delivery_configured": email_ready()}


@app.get("/admin/notifications/recipients")
def get_notification_recipients(
    current_user: dict = Depends(require_admin),
):
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT user_id, full_name, email
            FROM users
            WHERE role = 'AMBASSADOR' AND password_hash IS NOT NULL
            ORDER BY LOWER(full_name), user_id
        """)).fetchall()
    return {"ambassadors": [dict(row._mapping) for row in rows]}


@app.get("/admin/activity-logs")
def get_admin_activity_logs(
    limit: int = 100,
    current_user: dict = Depends(require_admin),
):
    safe_limit = max(1, min(limit, 200))
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT l.activity_id, l.action, l.entity_type, l.entity_id,
                l.summary, l.created_at, u.full_name AS admin_name,
                u.email AS admin_email
            FROM admin_activity_logs l
            LEFT JOIN users u ON u.user_id = l.admin_user_id
            ORDER BY l.created_at DESC, l.activity_id DESC
            LIMIT :limit
        """), {"limit": safe_limit}).fetchall()
    return {"activities": [dict(row._mapping) for row in rows]}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        return {"database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {e}",
        )


@app.post("/register")
def register_ambassador(data: RegisterRequest, background_tasks: BackgroundTasks):
    try:
        if len(data.password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 6 characters long.",
            )

        if not data.full_name.strip():
            raise HTTPException(status_code=400, detail="Full name is required.")

        if not data.college_name.strip():
            raise HTTPException(status_code=400, detail="College name is required.")

        hashed_password = password_hash.hash(data.password)
        phone_number = normalize_phone_number(data.phone_number)
        if not phone_number:
            raise HTTPException(status_code=400, detail="Mobile number is required.")

        with engine.begin() as conn:
            existing_user = conn.execute(
                text(
                    """
                    SELECT user_id
                    FROM users
                    WHERE LOWER(email) = LOWER(:email)
                    """
                ),
                {"email": str(data.email)},
            ).fetchone()

            if existing_user:
                raise HTTPException(
                    status_code=409,
                    detail="A user with this email already exists.",
                )

            user_result = conn.execute(
                text(
                    """
                    INSERT INTO users (full_name, email, role, password_hash, phone_number)
                    VALUES (:full_name, :email, 'AMBASSADOR', :password_hash, :phone_number)
                    RETURNING user_id
                    """
                ),
                {
                    "full_name": data.full_name.strip(),
                    "email": str(data.email).lower(),
                    "password_hash": hashed_password,
                    "phone_number": phone_number,
                },
            )
            user_id = user_result.scalar_one()

            ambassador_result = conn.execute(
                text(
                    """
                    INSERT INTO ambassadors (
                        user_id,
                        college_name,
                        graduation_year,
                        status
                    )
                    VALUES (
                        :user_id,
                        :college_name,
                        :graduation_year,
                        'PENDING'
                    )
                    RETURNING ambassador_id
                    """
                ),
                {
                    "user_id": user_id,
                    "college_name": data.college_name.strip(),
                    "graduation_year": data.graduation_year,
                },
            )
            ambassador_id = ambassador_result.scalar_one()

            invite_url = conn.execute(text("""
                SELECT whatsapp_group_invite_url FROM portal_settings
                WHERE settings_id = 1
            """)).scalar()
            welcome_queued = queue_welcome_email(
                conn, user_id, data.full_name.strip(), invite_url
            )

        if welcome_queued and email_ready():
            background_tasks.add_task(deliver_pending, engine)

        return {
            "message": "Ambassador registered successfully.",
            "user_id": user_id,
            "ambassador_id": ambassador_id,
            "status": "PENDING",
            "welcome_email_queued": welcome_queued,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {e}",
        )

@app.post("/login")
def login(data: LoginRequest, background_tasks: BackgroundTasks):
    try:
        with engine.connect() as conn:
            user = conn.execute(
                text(
                    """
                    SELECT user_id, full_name, email, role, password_hash
                    FROM users
                    WHERE LOWER(email) = LOWER(:email)
                    """
                ),
                {"email": str(data.email)},
            ).fetchone()

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        user_data = user._mapping

        if not user_data["password_hash"]:
            raise HTTPException(
                status_code=401,
                detail="This account does not have a password configured.",
            )

        valid_password = password_hash.verify(
            data.password,
            user_data["password_hash"],
        )

        if not valid_password:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password.",
            )

        if user_data["role"] == "AMBASSADOR":
            with engine.begin() as conn:
                invite_url = conn.execute(text("""
                    SELECT whatsapp_group_invite_url FROM portal_settings
                    WHERE settings_id = 1
                """)).scalar()
                welcome_queued = queue_welcome_email(
                    conn,
                    user_data["user_id"],
                    user_data["full_name"],
                    invite_url,
                )
            if welcome_queued and email_ready():
                background_tasks.add_task(deliver_pending, engine)

        now = datetime.now(timezone.utc)

        token_payload = {
            "sub": str(user_data["user_id"]),
            "role": user_data["role"],
            "email": user_data["email"],
            "iat": now,
            "exp": now + timedelta(hours=JWT_EXPIRATION_HOURS),
        }

        access_token = jwt.encode(
            token_payload,
            JWT_SECRET,
            algorithm=JWT_ALGORITHM,
        )

        return {
            "message": "Login successful.",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "user_id": user_data["user_id"],
                "full_name": user_data["full_name"],
                "email": user_data["email"],
                "role": user_data["role"],
            },
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Login failed: {e}",
        )


@app.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    generic_message = (
        "If an account exists for that email, a password-reset link has been sent."
    )
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    email_limit_hash = privacy_preserving_rate_limit_hash(
        "email",
        str(data.email),
    )
    client_ip = request.client.host if request.client else "unknown"
    ip_limit_hash = privacy_preserving_rate_limit_hash("ip", client_ip)
    queued = False
    with engine.begin() as conn:
        conn.execute(text("""
            DELETE FROM password_reset_attempts
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
        """))
        limits = conn.execute(text("""
            SELECT
                COUNT(*) FILTER (
                    WHERE email_hash = :email_hash
                      AND created_at > CURRENT_TIMESTAMP - INTERVAL '15 minutes'
                )::INT AS email_attempts,
                COUNT(*) FILTER (
                    WHERE ip_hash = :ip_hash
                      AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour'
                )::INT AS ip_attempts
            FROM password_reset_attempts
        """), {
            "email_hash": email_limit_hash,
            "ip_hash": ip_limit_hash,
        }).fetchone()
        if limits.email_attempts >= 3 or limits.ip_attempts >= 20:
            return {"message": generic_message}
        conn.execute(text("""
            INSERT INTO password_reset_attempts (email_hash, ip_hash)
            VALUES (:email_hash, :ip_hash)
        """), {
            "email_hash": email_limit_hash,
            "ip_hash": ip_limit_hash,
        })
        user = conn.execute(text("""
            SELECT user_id, full_name
            FROM users
            WHERE LOWER(email) = LOWER(:email)
              AND password_hash IS NOT NULL
        """), {"email": str(data.email)}).fetchone()
        if user:
            recent_request = conn.execute(text("""
                SELECT 1 FROM password_reset_requests
                WHERE user_id = :user_id
                  AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'
                LIMIT 1
            """), {"user_id": user.user_id}).scalar()
            if not recent_request:
                reset_request_id = conn.execute(text("""
                    INSERT INTO password_reset_requests (
                        user_id, token_hash, expires_at
                    )
                    VALUES (
                        :user_id, :token_hash,
                        CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                    )
                    RETURNING reset_request_id
                """), {
                    "user_id": user.user_id,
                    "token_hash": token_hash,
                }).scalar_one()
                reset_url = f"{portal_url()}/reset-password?token={raw_token}"
                queued = queue_password_reset_email(
                    conn,
                    user.user_id,
                    user.full_name,
                    reset_request_id,
                    reset_url,
                )
    if queued and email_ready():
        background_tasks.add_task(deliver_pending, engine)
    return {"message": generic_message}


@app.post("/reset-password")
def reset_password(
    data: PasswordResetRequest,
    background_tasks: BackgroundTasks,
):
    if len(data.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters.",
        )
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    new_password_hash = password_hash.hash(data.password)
    with engine.begin() as conn:
        request_row = conn.execute(text("""
            UPDATE password_reset_requests
            SET used_at = CURRENT_TIMESTAMP
            WHERE token_hash = :token_hash
              AND used_at IS NULL
              AND expires_at > CURRENT_TIMESTAMP
            RETURNING reset_request_id, user_id
        """), {"token_hash": token_hash}).fetchone()
        if not request_row:
            raise HTTPException(
                status_code=400,
                detail="This password-reset link is invalid or has expired.",
            )
        user = conn.execute(text("""
            UPDATE users SET password_hash = :password_hash
            WHERE user_id = :user_id
            RETURNING full_name
        """), {
            "password_hash": new_password_hash,
            "user_id": request_row.user_id,
        }).fetchone()
        conn.execute(text("""
            UPDATE password_reset_requests
            SET used_at = COALESCE(used_at, CURRENT_TIMESTAMP)
            WHERE user_id = :user_id AND used_at IS NULL
        """), {"user_id": request_row.user_id})
        confirmation_queued = queue_password_changed_email(
            conn,
            request_row.user_id,
            user.full_name,
            request_row.reset_request_id,
        )
    if confirmation_queued and email_ready():
        background_tasks.add_task(deliver_pending, engine)
    return {"message": "Password changed successfully. You can now sign in."}


@app.put("/ambassador/profile/{user_id}")
def update_ambassador_profile(
    user_id: int,
    data: ProfileUpdateRequest,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(user_id, current_user)

    try:
        full_name = data.full_name.strip()
        college_name = data.college_name.strip()
        phone_number = normalize_phone_number(data.phone_number)

        if not full_name:
            raise HTTPException(
                status_code=400,
                detail="Full name is required.",
            )

        if not college_name:
            raise HTTPException(
                status_code=400,
                detail="College name is required.",
            )

        if data.graduation_year < 2000 or data.graduation_year > 2100:
            raise HTTPException(
                status_code=400,
                detail="Invalid graduation year.",
            )

        with engine.begin() as conn:
            ambassador = conn.execute(
                text("""
                    SELECT ambassador_id
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {
                    "user_id": user_id,
                },
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador not found.",
                )

            duplicate_email = conn.execute(
                text("""
                    SELECT user_id
                    FROM users
                    WHERE LOWER(email) = LOWER(:email)
                      AND user_id != :user_id
                    LIMIT 1
                """),
                {
                    "email": str(data.email),
                    "user_id": user_id,
                },
            ).fetchone()

            if duplicate_email:
                raise HTTPException(
                    status_code=409,
                    detail="That email address is already in use.",
                )

            conn.execute(
                text("""
                    UPDATE users
                    SET
                        full_name = :full_name,
                        email = :email,
                        phone_number = :phone_number
                    WHERE user_id = :user_id
                """),
                {
                    "full_name": full_name,
                    "email": str(data.email),
                    "phone_number": phone_number,
                    "user_id": user_id,
                },
            )

            conn.execute(
                text("""
                    UPDATE ambassadors
                    SET
                        college_name = :college_name,
                        graduation_year = :graduation_year
                    WHERE user_id = :user_id
                """),
                {
                    "college_name": college_name,
                    "graduation_year": data.graduation_year,
                    "user_id": user_id,
                },
            )

            updated = conn.execute(
                text("""
                    SELECT
                        u.user_id,
                        a.ambassador_id,
                        u.full_name,
                        u.email,
                        u.phone_number,
                        a.college_name,
                        a.graduation_year,
                        a.status
                    FROM users u
                    JOIN ambassadors a
                        ON a.user_id = u.user_id
                    WHERE u.user_id = :user_id
                """),
                {
                    "user_id": user_id,
                },
            ).fetchone()

        return {
            "message": "Profile updated successfully.",
            "profile": dict(updated._mapping),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update profile: {e}",
        )
@app.get("/ambassador/profile/{user_id}")
def get_ambassador_profile(
    user_id: int,
    current_user: dict = Depends(require_ambassador),
):
    """Returns the real ambassador profile stored in PostgreSQL."""
    require_own_user_id(user_id, current_user)

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        u.user_id,
                        u.full_name,
                        u.email,
                        u.phone_number,
                        u.role,
                        a.ambassador_id,
                        a.college_name,
                        a.graduation_year,
                        a.status
                    FROM users u
                    JOIN ambassadors a
                        ON u.user_id = a.user_id
                    WHERE u.user_id = :user_id
                """),
                {"user_id": user_id},
            )

            row = result.fetchone()

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador profile not found."
                )

            return {
                "profile": dict(row._mapping)
            }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load ambassador profile: {e}"
        )

class SocialAccountConnectRequest(BaseModel):
    user_id: int
    platform: str
    platform_user_id: str
    profile_handle: str
    follower_count: int = 0


@app.get("/ambassador/social-accounts/{user_id}")
def get_social_accounts(
    user_id: int,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(user_id, current_user)

    try:
        with engine.connect() as conn:
            ambassador = conn.execute(
                text("""
                    SELECT ambassador_id
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador profile not found."
                )

            ambassador_id = ambassador._mapping["ambassador_id"]

            result = conn.execute(
                text("""
                    SELECT
                        account_id,
                        platform,
                        platform_user_id,
                        profile_handle,
                        follower_count,
                        verified,
                        updated_at
                    FROM social_accounts
                    WHERE ambassador_id = :ambassador_id
                    ORDER BY platform
                """),
                {"ambassador_id": ambassador_id},
            )

            accounts = [dict(row._mapping) for row in result]

        return {
            "accounts": accounts
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load social accounts: {e}"
        )


@app.post("/ambassador/social-accounts/connect")
def connect_social_account(
    data: SocialAccountConnectRequest,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(data.user_id, current_user)

    try:
        platform = data.platform.upper()

        if platform not in {"INSTAGRAM", "LINKEDIN", "TWITTER"}:
            raise HTTPException(
                status_code=400,
                detail="Unsupported social platform."
            )

        if platform == "INSTAGRAM":
            raise HTTPException(
                status_code=400,
                detail=(
                    "Instagram must be connected through Instagram OAuth "
                    "now — use the 'Connect Instagram' button instead of "
                    "manual connect."
                ),
            )

        if not data.platform_user_id.strip():
            raise HTTPException(
                status_code=400,
                detail="Platform user ID is required."
            )

        if not data.profile_handle.strip():
            raise HTTPException(
                status_code=400,
                detail="Profile handle is required."
            )

        with engine.begin() as conn:
            ambassador = conn.execute(
                text("""
                    SELECT ambassador_id
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {"user_id": data.user_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador profile not found."
                )

            ambassador_id = ambassador._mapping["ambassador_id"]

            account = conn.execute(
                text("""
                    INSERT INTO social_accounts (
                        ambassador_id,
                        platform,
                        platform_user_id,
                        profile_handle,
                        follower_count,
                        verified,
                        updated_at
                    )
                    VALUES (
                        :ambassador_id,
                        :platform,
                        :platform_user_id,
                        :profile_handle,
                        :follower_count,
                        :verified,
                        CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (ambassador_id, platform)
                    DO UPDATE SET
                        platform_user_id = EXCLUDED.platform_user_id,
                        profile_handle = EXCLUDED.profile_handle,
                        follower_count = EXCLUDED.follower_count,
                        verified = EXCLUDED.verified,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING
                        account_id,
                        platform,
                        platform_user_id,
                        profile_handle,
                        follower_count,
                        verified,
                        updated_at
                """),
                {
                    "ambassador_id": ambassador_id,
                    "platform": platform,
                    "platform_user_id": data.platform_user_id.strip(),
                    "profile_handle": data.profile_handle.strip(),
                    "follower_count": data.follower_count,
                    # Prototype policy: manual connections are treated as
                    # verified by the server until real OAuth is implemented.
                    "verified": True,
                },
            ).fetchone()

            verified_exists = conn.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM social_accounts
                        WHERE ambassador_id = :ambassador_id
                          AND verified = TRUE
                    )
                """),
                {"ambassador_id": ambassador_id},
            ).scalar_one()

            new_status = "ACTIVE" if verified_exists else "PENDING"

            conn.execute(
                text("""
                    UPDATE ambassadors
                    SET status = :status
                    WHERE ambassador_id = :ambassador_id
                """),
                {
                    "status": new_status,
                    "ambassador_id": ambassador_id,
                },
            )

        return {
            "message": "Social account connected successfully.",
            "account": dict(account._mapping),
            "ambassador_status": new_status,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect social account: {e}"
        )


@app.delete("/ambassador/social-accounts/{user_id}/{platform}")
def disconnect_social_account(
    user_id: int,
    platform: str,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(user_id, current_user)

    try:
        platform = platform.upper()

        with engine.begin() as conn:
            ambassador = conn.execute(
                text("""
                    SELECT ambassador_id
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador profile not found."
                )

            ambassador_id = ambassador._mapping["ambassador_id"]

            deleted = conn.execute(
                text("""
                    DELETE FROM social_accounts
                    WHERE ambassador_id = :ambassador_id
                      AND platform = :platform
                    RETURNING account_id
                """),
                {
                    "ambassador_id": ambassador_id,
                    "platform": platform,
                },
            ).fetchone()

            if not deleted:
                raise HTTPException(
                    status_code=404,
                    detail="Social account not found."
                )

            verified_exists = conn.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM social_accounts
                        WHERE ambassador_id = :ambassador_id
                          AND verified = TRUE
                    )
                """),
                {"ambassador_id": ambassador_id},
            ).scalar_one()

            new_status = "ACTIVE" if verified_exists else "PENDING"

            conn.execute(
                text("""
                    UPDATE ambassadors
                    SET status = :status
                    WHERE ambassador_id = :ambassador_id
                """),
                {
                    "status": new_status,
                    "ambassador_id": ambassador_id,
                },
            )

        return {
            "message": "Social account disconnected successfully.",
            "ambassador_status": new_status,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to disconnect social account: {e}"
        )

@app.get("/ambassador/social-accounts/instagram/authorize")
def instagram_authorize(
    current_user: dict = Depends(require_ambassador),
):
    if not INSTAGRAM_APP_ID or not INSTAGRAM_REDIRECT_URI:
        raise HTTPException(
            status_code=500,
            detail="Instagram integration is not configured on this server.",
        )

    params = {
        "client_id": INSTAGRAM_APP_ID,
        "redirect_uri": INSTAGRAM_REDIRECT_URI,
        "response_type": "code",
        # instagram_business_basic is the self-serve scope covering
        # profile + media read access for Business/Creator accounts.
        "scope": "instagram_business_basic",
        "state": create_oauth_state(current_user["user_id"]),
    }

    return {
        "authorize_url": "https://api.instagram.com/oauth/authorize?" + urlencode(params)
    }


@app.get("/ambassador/social-accounts/instagram/callback")
def instagram_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    def redirect_with_error(message: str) -> RedirectResponse:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/ambassador/social-accounts"
                f"?instagram=error&message={quote(message)}"
        )

    if error:
        return redirect_with_error(error_description or error)

    if not code or not state:
        return redirect_with_error(
            "Instagram did not return an authorization code."
        )

    if not INSTAGRAM_APP_ID or not INSTAGRAM_APP_SECRET or not INSTAGRAM_REDIRECT_URI:
        return redirect_with_error(
            "Instagram integration is not configured on this server."
        )

    try:
        user_id = verify_oauth_state(state)
    except HTTPException as e:
        return redirect_with_error(str(e.detail))

    try:
        # Step 1 — exchange the authorization code for a short-lived
        # (1 hour) token.
        token_response = requests.post(
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": INSTAGRAM_APP_ID,
                "client_secret": INSTAGRAM_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": INSTAGRAM_REDIRECT_URI,
                "code": code,
            },
            timeout=15,
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        short_lived_token = token_data["access_token"]

        # Step 2 — exchange for a long-lived token (~60 days).
        exchange_response = requests.get(
            "https://graph.instagram.com/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": INSTAGRAM_APP_SECRET,
                "access_token": short_lived_token,
            },
            timeout=15,
        )
        exchange_response.raise_for_status()
        exchange_data = exchange_response.json()
        long_lived_token = exchange_data["access_token"]
        expires_in_seconds = exchange_data.get("expires_in", 60 * 24 * 60 * 60)

        # Step 3 — fetch the connected professional account's profile.
        profile_response = requests.get(
            "https://graph.instagram.com/me",
            params={
                "fields": "id,username,account_type,followers_count",
                "access_token": long_lived_token,
            },
            timeout=15,
        )
        profile_response.raise_for_status()
        profile_data = profile_response.json()

    except requests.RequestException as e:
        return redirect_with_error(f"Instagram connection failed: {e}")
    except (KeyError, ValueError):
        return redirect_with_error("Instagram returned an unexpected response.")

    try:
        with engine.begin() as conn:
            ambassador = conn.execute(
                text("SELECT ambassador_id FROM ambassadors WHERE user_id = :user_id"),
                {"user_id": user_id},
            ).fetchone()

            if not ambassador:
                return redirect_with_error("Ambassador profile not found.")

            ambassador_id = ambassador._mapping["ambassador_id"]

            conn.execute(
                text("""
                    INSERT INTO social_accounts (
                        ambassador_id, platform, platform_user_id,
                        profile_handle, access_token, token_expires_at,
                        follower_count, verified, updated_at
                    )
                    VALUES (
                        :ambassador_id, 'INSTAGRAM', :platform_user_id,
                        :profile_handle, :access_token, :token_expires_at,
                        :follower_count, TRUE, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (ambassador_id, platform)
                    DO UPDATE SET
                        platform_user_id = EXCLUDED.platform_user_id,
                        profile_handle = EXCLUDED.profile_handle,
                        access_token = EXCLUDED.access_token,
                        token_expires_at = EXCLUDED.token_expires_at,
                        follower_count = EXCLUDED.follower_count,
                        verified = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                """),
                {
                    "ambassador_id": ambassador_id,
                    "platform_user_id": str(profile_data["id"]),
                    "profile_handle": profile_data.get("username", ""),
                    "access_token": encrypt_token(long_lived_token),
                    "token_expires_at": datetime.now(timezone.utc)
                        + timedelta(seconds=expires_in_seconds),
                    "follower_count": profile_data.get("followers_count", 0),
                },
            )

            conn.execute(
                text("""
                    UPDATE ambassadors
                    SET status = 'ACTIVE'
                    WHERE ambassador_id = :ambassador_id
                """),
                {"ambassador_id": ambassador_id},
            )
    except Exception as e:
        return redirect_with_error(f"Failed to save Instagram connection: {e}")

    return RedirectResponse(
        url=f"{FRONTEND_URL}/ambassador/social-accounts?instagram=connected"
    )


@app.get("/ambassador/dashboard-data/{user_id}")
def get_ambassador_dashboard_data(
    user_id: int,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(user_id, current_user)

    try:
        with engine.connect() as conn:

            # ---------------------------------------------------------
            # 1. Find ambassador
            # ---------------------------------------------------------
            ambassador = conn.execute(
                text("""
                    SELECT
                        a.ambassador_id,
                        a.status,
                        u.full_name,
                        u.email,
                        u.phone_number,
                        a.college_name,
                        a.graduation_year
                    FROM ambassadors a
                    JOIN users u
                        ON u.user_id = a.user_id
                    WHERE a.user_id = :user_id
                """),
                {"user_id": user_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador profile not found."
                )

            ambassador_data = ambassador._mapping
            ambassador_id = ambassador_data["ambassador_id"]

            # ---------------------------------------------------------
            # 2. Real performance metrics
            #
            # Take ONLY the newest metric snapshot for each post.
            # ---------------------------------------------------------
            performance = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.likes_count,
                            ms.comments_count,
                            ms.shares_count,
                            ms.views_impressions,
                            ms.reach_count,
                            ms.saves_count,
                            ms.fetched_at
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    )
                    SELECT
                        COUNT(cp.post_id) AS published_posts,

                        COALESCE(
                            SUM(ls.reach_count),
                            0
                        ) AS total_reach,

                        COALESCE(
                            SUM(ls.likes_count),
                            0
                        ) AS total_likes,

                        COALESCE(
                            SUM(ls.comments_count),
                            0
                        ) AS total_comments,

                        COALESCE(
                            SUM(ls.shares_count),
                            0
                        ) AS total_shares,

                        COALESCE(
                            SUM(ls.saves_count),
                            0
                        ) AS total_saves

                    FROM campaign_posts cp

                    LEFT JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id

                    WHERE cp.ambassador_id = :ambassador_id
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            performance_data = performance._mapping

            total_reach = int(performance_data["total_reach"] or 0)

            total_engagements = (
                int(performance_data["total_likes"] or 0)
                + int(performance_data["total_comments"] or 0)
                + int(performance_data["total_shares"] or 0)
                + int(performance_data["total_saves"] or 0)
            )

            if total_reach > 0:
                engagement_rate = round(
                    (total_engagements / total_reach) * 100,
                    2
                )
            else:
                engagement_rate = 0.0

            # ---------------------------------------------------------
            # 3. Latest ambassador rating
            # ---------------------------------------------------------
            rating = conn.execute(
                text("""
                    SELECT
                        rating_id,
                        campaign_id,
                        normalized_score,
                        percentile_rank,
                        star_rating,
                        calculated_at
                    FROM ambassador_ratings
                    WHERE ambassador_id = :ambassador_id
                    ORDER BY calculated_at DESC, rating_id DESC
                    LIMIT 1
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            rating_data = (
                dict(rating._mapping)
                if rating
                else None
            )

            # ---------------------------------------------------------
            # 4. Calculate actual ranking by normalized score
            #
            # We use each ambassador's latest rating.
            # ---------------------------------------------------------
            ranking = conn.execute(
                text("""
                    WITH latest_ratings AS (
                        SELECT DISTINCT ON (ambassador_id)
                            ambassador_id,
                            normalized_score
                        FROM ambassador_ratings
                        ORDER BY
                            ambassador_id,
                            calculated_at DESC,
                            rating_id DESC
                    ),
                    ranked AS (
                        SELECT
                            ambassador_id,
                            normalized_score,
                            RANK() OVER (
                                ORDER BY normalized_score DESC
                            ) AS current_rank,
                            COUNT(*) OVER () AS total_ranked
                        FROM latest_ratings
                    )
                    SELECT
                        current_rank,
                        total_ranked
                    FROM ranked
                    WHERE ambassador_id = :ambassador_id
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            if ranking:
                ranking_data = {
                    "current_rank": int(
                        ranking._mapping["current_rank"]
                    ),
                    "total_ranked": int(
                        ranking._mapping["total_ranked"]
                    ),
                }
            else:
                ranking_data = {
                    "current_rank": None,
                    "total_ranked": 0,
                }

            # ---------------------------------------------------------
            # 5. Current active campaign
            # ---------------------------------------------------------
            campaign = conn.execute(
                text("""
                    SELECT
                        campaign_id,
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active
                    FROM campaigns
                    WHERE is_active = TRUE
                      AND CURRENT_DATE BETWEEN start_date AND end_date
                    ORDER BY end_date ASC
                    LIMIT 1
                """)
            ).fetchone()

            campaign_data = (
                dict(campaign._mapping)
                if campaign
                else None
            )

            # ---------------------------------------------------------
            # 6. Latest campaign submission
            # ---------------------------------------------------------
            latest_submission = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (post_id)
                            post_id,
                            likes_count,
                            comments_count,
                            shares_count,
                            views_impressions,
                            reach_count,
                            saves_count,
                            fetched_at
                        FROM metric_snapshots
                        ORDER BY
                            post_id,
                            fetched_at DESC,
                            snapshot_id DESC
                    )
                    SELECT
                        cp.post_id,
                        cp.platform,
                        cp.post_url,
                        cp.platform_post_id,
                        cp.published_at,
                        cp.is_verified,
                        c.campaign_id,
                        c.title AS campaign_title,
                        COALESCE(ls.reach_count, 0) AS reach_count,
                        COALESCE(ls.likes_count, 0) AS likes_count,
                        COALESCE(ls.comments_count, 0) AS comments_count,
                        COALESCE(ls.shares_count, 0) AS shares_count,
                        COALESCE(ls.saves_count, 0) AS saves_count,
                        ls.fetched_at
                    FROM campaign_posts cp

                    JOIN campaigns c
                        ON c.campaign_id = cp.campaign_id

                    LEFT JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id

                    WHERE cp.ambassador_id = :ambassador_id

                    ORDER BY
                        cp.published_at DESC NULLS LAST,
                        cp.post_id DESC

                    LIMIT 1
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            latest_submission_data = (
                dict(latest_submission._mapping)
                if latest_submission
                else None
            )

        return {
            "profile": {
                "user_id": user_id,
                "ambassador_id": ambassador_id,
                "full_name": ambassador_data["full_name"],
                "email": ambassador_data["email"],
                "college_name": ambassador_data["college_name"],
                "graduation_year": ambassador_data["graduation_year"],
                "status": ambassador_data["status"],
            },

            "metrics": {
                "total_reach": total_reach,
                "engagement_rate": engagement_rate,
                "published_posts": int(
                    performance_data["published_posts"] or 0
                ),
                "total_engagements": total_engagements,
            },

            "rating": rating_data,

            "ranking": ranking_data,

            "active_campaign": campaign_data,

            "latest_submission": latest_submission_data,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load dashboard data: {e}"
        )

@app.get("/ambassador/campaigns")
def get_ambassador_campaigns(
    current_user: dict = Depends(require_ambassador),
):
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        campaign_id,
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active,
                        CASE
                            WHEN CURRENT_DATE < start_date THEN 'UPCOMING'
                            WHEN CURRENT_DATE > end_date THEN 'COMPLETED'
                            WHEN is_active = TRUE
                                 AND CURRENT_DATE BETWEEN start_date AND end_date
                                THEN 'ACTIVE'
                            ELSE 'COMPLETED'
                        END AS status
                    FROM campaigns
                    ORDER BY start_date DESC, campaign_id DESC
                """)
            )

            campaigns = [dict(row._mapping) for row in result]

        return {
            "campaigns": campaigns
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load campaigns: {e}"
        )

class CampaignPostSubmitRequest(BaseModel):
    user_id: int
    campaign_id: int
    platform: str
    post_url: str
    platform_post_id: str | None = None


@app.get("/ambassador/campaigns/{campaign_id}")
def get_campaign_detail(
    campaign_id: int,
    current_user: dict = Depends(require_ambassador),
):
    try:
        with engine.connect() as conn:
            campaign = conn.execute(
                text("""
                    SELECT
                        campaign_id,
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active,
                        CASE
                            WHEN CURRENT_DATE < start_date THEN 'UPCOMING'
                            WHEN CURRENT_DATE > end_date THEN 'COMPLETED'
                            WHEN is_active = TRUE
                                 AND CURRENT_DATE BETWEEN start_date AND end_date
                                THEN 'ACTIVE'
                            ELSE 'COMPLETED'
                        END AS status
                    FROM campaigns
                    WHERE campaign_id = :campaign_id
                """),
                {"campaign_id": campaign_id},
            ).fetchone()

            if not campaign:
                raise HTTPException(
                    status_code=404,
                    detail="Campaign not found."
                )

        return {
            "campaign": dict(campaign._mapping)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load campaign: {e}"
        )


@app.get("/ambassador/campaigns/{campaign_id}/submission/{user_id}")
def get_campaign_submission(
    campaign_id: int,
    user_id: int,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(user_id, current_user)

    try:
        with engine.connect() as conn:
            ambassador = conn.execute(
                text("""
                    SELECT ambassador_id
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {"user_id": user_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador not found."
                )

            ambassador_id = ambassador._mapping["ambassador_id"]

            submission = conn.execute(
                text("""
                    WITH latest_snapshot AS (
                        SELECT DISTINCT ON (post_id)
                            post_id,
                            likes_count,
                            comments_count,
                            shares_count,
                            views_impressions,
                            reach_count,
                            saves_count,
                            fetched_at
                        FROM metric_snapshots
                        ORDER BY
                            post_id,
                            fetched_at DESC,
                            snapshot_id DESC
                    )
                    SELECT
                        cp.post_id,
                        cp.platform,
                        cp.post_url,
                        cp.platform_post_id,
                        cp.published_at,
                        cp.is_verified,
                        COALESCE(ls.reach_count, 0) AS reach_count,
                        COALESCE(ls.likes_count, 0) AS likes_count,
                        COALESCE(ls.comments_count, 0) AS comments_count,
                        COALESCE(ls.shares_count, 0) AS shares_count,
                        COALESCE(ls.saves_count, 0) AS saves_count,
                        ls.fetched_at,
                        a.status AS ambassador_status,
                        rating.calculated_at AS rating_calculated_at,
                        rating.star_rating AS rating_star_rating,
                        campaign_metrics.latest_campaign_metrics_at
                    FROM campaign_posts cp
                    LEFT JOIN latest_snapshot ls
                        ON ls.post_id = cp.post_id
                    JOIN ambassadors a ON a.ambassador_id = cp.ambassador_id
                    LEFT JOIN LATERAL (
                        SELECT calculated_at, star_rating
                        FROM ambassador_ratings
                        WHERE ambassador_id = cp.ambassador_id
                          AND campaign_id = cp.campaign_id
                        ORDER BY calculated_at DESC, rating_id DESC
                        LIMIT 1
                    ) rating ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT MAX(ms.fetched_at) AS latest_campaign_metrics_at
                        FROM metric_snapshots ms
                        JOIN campaign_posts other_post ON other_post.post_id = ms.post_id
                        JOIN ambassadors other_ambassador
                            ON other_ambassador.ambassador_id = other_post.ambassador_id
                        WHERE other_post.campaign_id = cp.campaign_id
                          AND other_post.is_verified = TRUE
                          AND other_ambassador.status = 'ACTIVE'
                    ) campaign_metrics ON TRUE
                    WHERE cp.ambassador_id = :ambassador_id
                      AND cp.campaign_id = :campaign_id
                    ORDER BY
                        cp.published_at DESC NULLS LAST,
                        cp.post_id DESC
                    LIMIT 1
                """),
                {
                    "ambassador_id": ambassador_id,
                    "campaign_id": campaign_id,
                },
            ).fetchone()

        return {
            "submission":
                dict(submission._mapping)
                if submission
                else None
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load submission: {e}"
        )

@app.post("/ambassador/campaign-posts")
def submit_campaign_post(
    data: CampaignPostSubmitRequest,
    current_user: dict = Depends(require_ambassador),
):
    require_own_user_id(data.user_id, current_user)

    try:
        platform = data.platform.upper()
        post_url = data.post_url.strip().rstrip("/")

        if platform not in {
            "INSTAGRAM",
            "LINKEDIN",
            "TWITTER",
        }:
            raise HTTPException(
                status_code=400,
                detail="Unsupported platform.",
            )

        if not post_url:
            raise HTTPException(
                status_code=400,
                detail="Post URL is required.",
            )

        # Use supplied platform post ID when available.
        # Otherwise derive a temporary ID from the URL.
        platform_post_id = (
            data.platform_post_id.strip()
            if data.platform_post_id
            else post_url.split("/")[-1]
        )

        if not platform_post_id:
            raise HTTPException(
                status_code=400,
                detail="Could not determine the post ID.",
            )

        with engine.begin() as conn:
            # ---------------------------------------------
            # Find ambassador
            # ---------------------------------------------
            ambassador = conn.execute(
                text("""
                    SELECT
                        ambassador_id,
                        status
                    FROM ambassadors
                    WHERE user_id = :user_id
                """),
                {
                    "user_id": data.user_id,
                },
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador not found.",
                )

            ambassador_id = ambassador._mapping["ambassador_id"]

            if ambassador._mapping["status"] != "ACTIVE":
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "You must have a verified social "
                        "account before submitting campaign posts."
                    ),
                )

            # ---------------------------------------------
            # Validate campaign
            # ---------------------------------------------
            campaign = conn.execute(
                text("""
                    SELECT
                        campaign_id,
                        start_date,
                        end_date,
                        is_active
                    FROM campaigns
                    WHERE campaign_id = :campaign_id
                """),
                {
                    "campaign_id": data.campaign_id,
                },
            ).fetchone()

            if not campaign:
                raise HTTPException(
                    status_code=404,
                    detail="Campaign not found.",
                )

            today = date.today()

            campaign_start = campaign._mapping["start_date"]
            campaign_end = campaign._mapping["end_date"]
            campaign_is_active = campaign._mapping["is_active"]

            if not campaign_is_active:
                raise HTTPException(
                    status_code=403,
                    detail="This campaign is not active.",
                )

            if today < campaign_start:
                raise HTTPException(
                    status_code=403,
                    detail="This campaign has not started yet.",
                )

            if today > campaign_end:
                raise HTTPException(
                    status_code=403,
                    detail="This campaign has already ended.",
                )

            # ---------------------------------------------
            # Validate connected social account
            # ---------------------------------------------
            connected_account = conn.execute(
                text("""
                    SELECT account_id
                    FROM social_accounts
                    WHERE ambassador_id = :ambassador_id
                      AND platform = :platform
                      AND verified = TRUE
                """),
                {
                    "ambassador_id": ambassador_id,
                    "platform": platform,
                },
            ).fetchone()

            if not connected_account:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"Connect and verify your "
                        f"{platform.title()} account before "
                        f"submitting a post from that platform."
                    ),
                )

            # ---------------------------------------------
            # Prevent duplicate submissions
            # ---------------------------------------------
            duplicate = conn.execute(
                text("""
                    SELECT
                        post_id,
                        post_url
                    FROM campaign_posts
                    WHERE campaign_id = :campaign_id
                      AND ambassador_id = :ambassador_id
                      AND platform = :platform
                      AND (
                          platform_post_id = :platform_post_id
                          OR RTRIM(post_url, '/') = :post_url
                      )
                    LIMIT 1
                """),
                {
                    "campaign_id": data.campaign_id,
                    "ambassador_id": ambassador_id,
                    "platform": platform,
                    "platform_post_id": platform_post_id,
                    "post_url": post_url,
                },
            ).fetchone()

            if duplicate:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "This post has already been submitted "
                        "for this campaign."
                    ),
                )

            # ---------------------------------------------
            # Insert new submission
            # ---------------------------------------------
            post = conn.execute(
                text("""
                    INSERT INTO campaign_posts (
                        campaign_id,
                        ambassador_id,
                        platform,
                        post_url,
                        platform_post_id,
                        published_at,
                        is_verified
                    )
                    VALUES (
                        :campaign_id,
                        :ambassador_id,
                        :platform,
                        :post_url,
                        :platform_post_id,
                        CURRENT_TIMESTAMP,
                        FALSE
                    )
                    RETURNING
                        post_id,
                        campaign_id,
                        ambassador_id,
                        platform,
                        post_url,
                        platform_post_id,
                        published_at,
                        is_verified
                """),
                {
                    "campaign_id": data.campaign_id,
                    "ambassador_id": ambassador_id,
                    "platform": platform,
                    "post_url": post_url,
                    "platform_post_id": platform_post_id,
                },
            ).fetchone()

        return {
            "message": "Campaign post submitted successfully.",
            "post": dict(post._mapping),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to submit campaign post: {e}",
        )
@app.get("/admin/ambassadors/export.csv")
def export_admin_ambassadors_csv(
    current_user: dict = Depends(require_admin),
):
    def csv_safe(value) -> str:
        rendered = "" if value is None else str(value)
        return f"'{rendered}" if rendered.startswith(("=", "+", "-", "@")) else rendered

    with engine.connect() as conn:
        rows = conn.execute(text("""
            WITH social_summary AS (
                SELECT ambassador_id,
                    STRING_AGG(
                        platform || ': @' || profile_handle ||
                        CASE WHEN verified THEN ' (verified)' ELSE ' (pending)' END,
                        '; ' ORDER BY platform
                    ) AS social_accounts
                FROM social_accounts
                GROUP BY ambassador_id
            )
            SELECT u.full_name, u.email, u.phone_number,
                a.college_name, a.graduation_year, a.status,
                COALESCE(s.social_accounts, '') AS social_accounts,
                u.created_at
            FROM ambassadors a
            JOIN users u ON u.user_id = a.user_id
            LEFT JOIN social_summary s ON s.ambassador_id = a.ambassador_id
            ORDER BY u.full_name, u.user_id
        """)).fetchall()

    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow([
        "Full Name", "Email", "Mobile Number", "College / University",
        "Graduation Year", "Status", "Social Accounts", "Registered At",
    ])
    for row in rows:
        item = row._mapping
        writer.writerow([
            csv_safe(item["full_name"]), csv_safe(item["email"]),
            csv_safe(item["phone_number"]), csv_safe(item["college_name"]),
            item["graduation_year"], item["status"],
            csv_safe(item["social_accounts"]), item["created_at"].isoformat(),
        ])
    with engine.begin() as conn:
        log_admin_activity(
            conn,
            current_user,
            "AMBASSADOR_CSV_EXPORTED",
            f"Exported {len(rows)} ambassador record(s) to CSV.",
            "ambassador",
        )
    return Response(
        content="\ufeff" + output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="cipd-ambassadors-{date.today().isoformat()}.csv"'
            )
        },
    )


@app.get("/admin/ambassadors")
def get_admin_ambassadors(
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.reach_count,
                            ms.likes_count,
                            ms.comments_count,
                            ms.shares_count,
                            ms.saves_count,
                            ms.fetched_at
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    ),

                    ambassador_performance AS (
                        SELECT
                            cp.ambassador_id,
                            COALESCE(SUM(ls.reach_count), 0) AS total_reach
                        FROM campaign_posts cp
                        LEFT JOIN latest_snapshots ls
                            ON ls.post_id = cp.post_id
                        GROUP BY cp.ambassador_id
                    ),

                    latest_ratings AS (
                        SELECT DISTINCT ON (ar.ambassador_id)
                            ar.ambassador_id,
                            ar.normalized_score,
                            ar.star_rating,
                            ar.calculated_at
                        FROM ambassador_ratings ar
                        ORDER BY
                            ar.ambassador_id,
                            ar.calculated_at DESC,
                            ar.rating_id DESC
                    ),

                    social_platforms AS (
                        SELECT
                            sa.ambassador_id,
                            STRING_AGG(
                                DISTINCT sa.platform,
                                ', '
                                ORDER BY sa.platform
                            ) FILTER (WHERE sa.verified = TRUE)
                                AS platforms
                        FROM social_accounts sa
                        GROUP BY sa.ambassador_id
                    )

                    SELECT
                        a.ambassador_id,
                        u.user_id,
                        u.full_name,
                        u.email,
                        u.phone_number,
                        a.college_name,
                        a.graduation_year,
                        a.status,

                        COALESCE(
                            sp.platforms,
                            ''
                        ) AS platforms,

                        COALESCE(
                            ap.total_reach,
                            0
                        ) AS total_reach,

                        lr.normalized_score,
                        lr.star_rating

                    FROM ambassadors a

                    JOIN users u
                        ON u.user_id = a.user_id

                    LEFT JOIN social_platforms sp
                        ON sp.ambassador_id = a.ambassador_id

                    LEFT JOIN ambassador_performance ap
                        ON ap.ambassador_id = a.ambassador_id

                    LEFT JOIN latest_ratings lr
                        ON lr.ambassador_id = a.ambassador_id

                    ORDER BY
                        u.full_name ASC
                """)
            )

            ambassadors = [
                dict(row._mapping)
                for row in result
            ]

        return {
            "ambassadors": ambassadors
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load ambassadors: {e}"
        )

@app.get("/admin/ambassadors/{ambassador_id}")
def get_admin_ambassador_detail(
    ambassador_id: int,
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:

            ambassador = conn.execute(
                text("""
                    SELECT
                        a.ambassador_id,
                        u.user_id,
                        u.full_name,
                        u.email,
                        u.phone_number,
                        a.college_name,
                        a.graduation_year,
                        a.status
                    FROM ambassadors a
                    JOIN users u
                        ON u.user_id = a.user_id
                    WHERE a.ambassador_id = :ambassador_id
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            if not ambassador:
                raise HTTPException(
                    status_code=404,
                    detail="Ambassador not found."
                )

            social_result = conn.execute(
                text("""
                    SELECT
                        account_id,
                        platform,
                        profile_handle,
                        follower_count,
                        verified,
                        updated_at
                    FROM social_accounts
                    WHERE ambassador_id = :ambassador_id
                    ORDER BY platform
                """),
                {"ambassador_id": ambassador_id},
            )

            social_accounts = [
                dict(row._mapping)
                for row in social_result
            ]

            submissions_result = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.snapshot_id,
                            ms.fetched_at,
                            ms.likes_count,
                            ms.comments_count,
                            ms.shares_count,
                            ms.views_impressions,
                            ms.reach_count,
                            ms.saves_count
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    )
                    SELECT
                        cp.post_id,
                        cp.campaign_id,
                        c.title AS campaign_title,
                        cp.platform,
                        cp.post_url,
                        cp.platform_post_id,
                        cp.published_at,
                        cp.is_verified,

                        ls.snapshot_id,
                        ls.fetched_at,

                        COALESCE(ls.reach_count, 0)
                            AS reach_count,

                        COALESCE(ls.likes_count, 0)
                            AS likes_count,

                        COALESCE(ls.comments_count, 0)
                            AS comments_count,

                        COALESCE(ls.shares_count, 0)
                            AS shares_count,

                        COALESCE(ls.saves_count, 0)
                            AS saves_count,

                        COALESCE(ls.views_impressions, 0)
                            AS views_impressions

                    FROM campaign_posts cp

                    JOIN campaigns c
                        ON c.campaign_id = cp.campaign_id

                    LEFT JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id

                    WHERE cp.ambassador_id = :ambassador_id

                    ORDER BY
                        cp.published_at DESC NULLS LAST,
                        cp.post_id DESC
                """),
                {"ambassador_id": ambassador_id},
            )

            submissions = [
                dict(row._mapping)
                for row in submissions_result
            ]

            total_reach = sum(
                int(post["reach_count"] or 0)
                for post in submissions
            )

            total_engagements = sum(
                int(post["likes_count"] or 0)
                + int(post["comments_count"] or 0)
                + int(post["shares_count"] or 0)
                + int(post["saves_count"] or 0)
                for post in submissions
            )

            engagement_rate = (
                round(
                    (total_engagements / total_reach) * 100,
                    2
                )
                if total_reach > 0
                else 0.0
            )

            rating = conn.execute(
                text("""
                    SELECT
                        normalized_score,
                        percentile_rank,
                        star_rating,
                        campaign_id,
                        calculated_at
                    FROM ambassador_ratings
                    WHERE ambassador_id = :ambassador_id
                    ORDER BY
                        calculated_at DESC,
                        rating_id DESC
                    LIMIT 1
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            rating_data = (
                dict(rating._mapping)
                if rating
                else None
            )

            ranking = conn.execute(
                text("""
                    WITH latest_ratings AS (
                        SELECT DISTINCT ON (ambassador_id)
                            ambassador_id,
                            normalized_score
                        FROM ambassador_ratings
                        ORDER BY
                            ambassador_id,
                            calculated_at DESC,
                            rating_id DESC
                    ),

                    ranked AS (
                        SELECT
                            ambassador_id,
                            RANK() OVER (
                                ORDER BY normalized_score DESC
                            ) AS current_rank,
                            COUNT(*) OVER () AS total_ranked
                        FROM latest_ratings
                    )

                    SELECT
                        current_rank,
                        total_ranked
                    FROM ranked
                    WHERE ambassador_id = :ambassador_id
                """),
                {"ambassador_id": ambassador_id},
            ).fetchone()

            ranking_data = (
                {
                    "current_rank":
                        int(ranking._mapping["current_rank"]),
                    "total_ranked":
                        int(ranking._mapping["total_ranked"]),
                }
                if ranking
                else {
                    "current_rank": None,
                    "total_ranked": 0,
                }
            )

        return {
            "ambassador": dict(ambassador._mapping),
            "social_accounts": social_accounts,
            "metrics": {
                "total_reach": total_reach,
                "total_engagements": total_engagements,
                "engagement_rate": engagement_rate,
            },
            "rating": rating_data,
            "ranking": ranking_data,
            "submissions": submissions,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load ambassador: {e}"
        )


@app.post("/admin/campaign-posts/{post_id}/verify")
def verify_campaign_post(
    post_id: int,
    data: MetricVerificationRequest,
    current_user: dict = Depends(require_admin),
):
    try:
        metric_values = [
            data.reach_count,
            data.likes_count,
            data.comments_count,
            data.shares_count,
            data.saves_count,
            data.views_impressions,
        ]

        if any(value < 0 for value in metric_values):
            raise HTTPException(
                status_code=400,
                detail="Metrics cannot be negative."
            )

        with engine.begin() as conn:

            post = conn.execute(
                text("""
                    SELECT post_id
                    FROM campaign_posts
                    WHERE post_id = :post_id
                """),
                {"post_id": post_id},
            ).fetchone()

            if not post:
                raise HTTPException(
                    status_code=404,
                    detail="Campaign post not found."
                )

            conn.execute(
                text("""
                    UPDATE campaign_posts
                    SET is_verified = TRUE
                    WHERE post_id = :post_id
                """),
                {"post_id": post_id},
            )

            snapshot = conn.execute(
                text("""
                    INSERT INTO metric_snapshots (
                        post_id,
                        likes_count,
                        comments_count,
                        shares_count,
                        views_impressions,
                        reach_count,
                        saves_count
                    )
                    VALUES (
                        :post_id,
                        :likes_count,
                        :comments_count,
                        :shares_count,
                        :views_impressions,
                        :reach_count,
                        :saves_count
                    )
                    RETURNING
                        snapshot_id,
                        post_id,
                        fetched_at,
                        likes_count,
                        comments_count,
                        shares_count,
                        views_impressions,
                        reach_count,
                        saves_count
                """),
                {
                    "post_id": post_id,
                    "likes_count": data.likes_count,
                    "comments_count": data.comments_count,
                    "shares_count": data.shares_count,
                    "views_impressions":
                        data.views_impressions,
                    "reach_count": data.reach_count,
                    "saves_count": data.saves_count,
                },
            ).fetchone()
            log_admin_activity(
                conn,
                current_user,
                "CAMPAIGN_POST_VERIFIED",
                f"Verified post #{post_id} and stored metric snapshot #{snapshot.snapshot_id}.",
                "campaign_post",
                post_id,
            )

        return {
            "message":
                "Post verified and metrics saved successfully.",
            "snapshot": dict(snapshot._mapping),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to verify post: {e}"
        )
@app.post("/admin/campaign-posts/{post_id}/sync-instagram-metrics")
def sync_instagram_metrics(
    post_id: int,
    current_user: dict = Depends(require_admin),
):
    """
    Pulls real reach/likes/comments/shares/saves/views for a submitted
    Instagram post straight from the Graph API, using the connected
    ambassador's own OAuth token, and verifies the post automatically
    since the numbers came directly from the platform.
    """
    try:
        with engine.begin() as conn:
            post = conn.execute(
                text("""
                    SELECT
                        post_id, ambassador_id, platform,
                        post_url, platform_post_id
                    FROM campaign_posts
                    WHERE post_id = :post_id
                """),
                {"post_id": post_id},
            ).fetchone()

            if not post:
                raise HTTPException(
                    status_code=404, detail="Campaign post not found."
                )

            post_row = post._mapping

            if post_row["platform"] != "INSTAGRAM":
                raise HTTPException(
                    status_code=400,
                    detail="Automatic metric sync is only available for Instagram posts.",
                )

            access_token = get_valid_instagram_token(
                post_row["ambassador_id"], conn
            )

            platform_post_id = post_row["platform_post_id"]

            # A non-numeric platform_post_id means it's still the URL
            # shortcode captured at submission time, not the real Graph
            # API media ID — resolve it once, then reuse it going forward.
            if not platform_post_id.isdigit():
                platform_post_id = resolve_instagram_media_id(
                    access_token, post_row["post_url"]
                )

            try:
                media_response = requests.get(
                    f"https://graph.instagram.com/{platform_post_id}",
                    params={
                        "fields": "like_count,comments_count",
                        "access_token": access_token,
                    },
                    timeout=15,
                )
                media_response.raise_for_status()
                media_data = media_response.json()

                insights_response = requests.get(
                    f"https://graph.instagram.com/{platform_post_id}/insights",
                    params={
                        "metric": "reach,views,saved,shares",
                        "access_token": access_token,
                    },
                    timeout=15,
                )
                insights_response.raise_for_status()
                insights_data = insights_response.json()
            except requests.RequestException as e:
                raise HTTPException(
                    status_code=502,
                    detail=f"Instagram did not return metrics for this post: {e}",
                )

            insight_values = {
                item["name"]: item.get("values", [{}])[-1].get("value", 0)
                for item in insights_data.get("data", [])
            }

            snapshot = conn.execute(
                text("""
                    INSERT INTO metric_snapshots (
                        post_id, likes_count, comments_count, shares_count,
                        views_impressions, reach_count, saves_count
                    )
                    VALUES (
                        :post_id, :likes_count, :comments_count, :shares_count,
                        :views_impressions, :reach_count, :saves_count
                    )
                    RETURNING
                        snapshot_id, post_id, fetched_at, likes_count,
                        comments_count, shares_count, views_impressions,
                        reach_count, saves_count
                """),
                {
                    "post_id": post_id,
                    "likes_count": media_data.get("like_count", 0),
                    "comments_count": media_data.get("comments_count", 0),
                    "shares_count": insight_values.get("shares", 0),
                    "views_impressions": insight_values.get("views", 0),
                    "reach_count": insight_values.get("reach", 0),
                    "saves_count": insight_values.get("saved", 0),
                },
            ).fetchone()

            conn.execute(
                text("""
                    UPDATE campaign_posts
                    SET platform_post_id = :platform_post_id,
                        is_verified = TRUE
                    WHERE post_id = :post_id
                """),
                {
                    "platform_post_id": platform_post_id,
                    "post_id": post_id,
                },
            )

            log_admin_activity(
                conn,
                current_user,
                "CAMPAIGN_POST_SYNCED_INSTAGRAM",
                f"Synced Instagram metrics for post #{post_id} and stored metric snapshot #{snapshot.snapshot_id}.",
                "campaign_post",
                post_id,
            )

        return {
            "message": "Instagram metrics synced and post verified.",
            "snapshot": dict(snapshot._mapping),
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to sync Instagram metrics: {e}",
        )


@app.get("/ambassador/leaderboard")
def get_ambassador_leaderboard(
    current_user: dict = Depends(require_ambassador),
):
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    WITH latest_ratings AS (
                        SELECT DISTINCT ON (ambassador_id)
                            ambassador_id,
                            normalized_score,
                            percentile_rank,
                            star_rating,
                            calculated_at
                        FROM ambassador_ratings
                        ORDER BY
                            ambassador_id,
                            calculated_at DESC,
                            rating_id DESC
                    ),

                    latest_snapshots AS (
                        SELECT DISTINCT ON (post_id)
                            post_id,
                            reach_count
                        FROM metric_snapshots
                        ORDER BY
                            post_id,
                            fetched_at DESC,
                            snapshot_id DESC
                    ),

                    ambassador_reach AS (
                        SELECT
                            cp.ambassador_id,
                            COALESCE(
                                SUM(ls.reach_count),
                                0
                            ) AS total_reach
                        FROM campaign_posts cp
                        LEFT JOIN latest_snapshots ls
                            ON ls.post_id = cp.post_id
                        WHERE cp.is_verified = TRUE
                        GROUP BY cp.ambassador_id
                    )

                    SELECT
                        a.ambassador_id,
                        a.user_id,
                        u.full_name,
                        a.college_name,
                        COALESCE(ar.total_reach, 0) AS total_reach,
                        lr.normalized_score,
                        lr.percentile_rank,
                        lr.star_rating,
                        RANK() OVER (
                            ORDER BY
                                lr.normalized_score DESC,
                                a.ambassador_id ASC
                        ) AS current_rank
                    FROM latest_ratings lr
                    JOIN ambassadors a
                        ON a.ambassador_id = lr.ambassador_id
                    JOIN users u
                        ON u.user_id = a.user_id
                    LEFT JOIN ambassador_reach ar
                        ON ar.ambassador_id = a.ambassador_id
                    WHERE a.status = 'ACTIVE'
                    ORDER BY
                        current_rank ASC,
                        a.ambassador_id ASC
                """)
            ).fetchall()

        return {
            "total_ranked": len(rows),
            "leaderboard": [
                dict(row._mapping)
                for row in rows
            ],
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load leaderboard: {e}",
        )


@app.get("/admin/campaigns/{campaign_id}")
def get_admin_campaign_detail(
    campaign_id: int,
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:
            campaign = conn.execute(
                text("""
                    SELECT
                        campaign_id,
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active,
                        CASE
                            WHEN CURRENT_DATE < start_date THEN 'UPCOMING'
                            WHEN CURRENT_DATE > end_date THEN 'COMPLETED'
                            WHEN is_active = TRUE
                                 AND CURRENT_DATE BETWEEN start_date AND end_date
                                THEN 'ACTIVE'
                            ELSE 'COMPLETED'
                        END AS status
                    FROM campaigns
                    WHERE campaign_id = :campaign_id
                """),
                {"campaign_id": campaign_id},
            ).fetchone()

        if not campaign:
            raise HTTPException(
                status_code=404,
                detail="Campaign not found.",
            )

        return {"campaign": dict(campaign._mapping)}

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load campaign: {e}",
        )


@app.post("/admin/campaigns/{campaign_id}/calculate-ratings")
def calculate_campaign_ratings(
    campaign_id: int,
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.begin() as conn:

            campaign = conn.execute(
                text("""
                    SELECT campaign_id, title
                    FROM campaigns
                    WHERE campaign_id = :campaign_id
                """),
                {"campaign_id": campaign_id},
            ).fetchone()

            if not campaign:
                raise HTTPException(
                    status_code=404,
                    detail="Campaign not found."
                )

            rows = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (post_id)
                            post_id,
                            reach_count,
                            likes_count,
                            comments_count,
                            shares_count,
                            saves_count
                        FROM metric_snapshots
                        ORDER BY
                            post_id,
                            fetched_at DESC,
                            snapshot_id DESC
                    )

                    SELECT
                        cp.ambassador_id,
                        cp.platform,
                        ls.reach_count,
                        ls.likes_count,
                        ls.comments_count,
                        ls.shares_count,
                        ls.saves_count

                    FROM campaign_posts cp

                    JOIN ambassadors a
                        ON a.ambassador_id = cp.ambassador_id

                    JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id

                    WHERE
                        cp.campaign_id = :campaign_id
                        AND cp.is_verified = TRUE
                        AND a.status = 'ACTIVE'
                """),
                {"campaign_id": campaign_id},
            ).fetchall()

            if not rows:
                raise HTTPException(
                    status_code=400,
                    detail="No verified campaign metrics are available."
                )

            # -------------------------------------------------
            # 1. Build post performance
            # -------------------------------------------------

            posts = []

            for row in rows:
                item = row._mapping

                reach = int(item["reach_count"] or 0)

                engagements = (
                    int(item["likes_count"] or 0)
                    + int(item["comments_count"] or 0)
                    + int(item["shares_count"] or 0)
                    + int(item["saves_count"] or 0)
                )

                engagement_rate = (
                    (engagements / reach) * 100
                    if reach > 0
                    else 0
                )

                posts.append({
                    "ambassador_id": item["ambassador_id"],
                    "platform": item["platform"],
                    "reach": reach,
                    "engagement_rate": engagement_rate,
                })

            # -------------------------------------------------
            # 2. Percentile helper
            # -------------------------------------------------

            def percentile_score(value, all_values):
                if len(all_values) == 1:
                    return 100.0

                lower_or_equal = sum(
                    1 for x in all_values if x <= value
                )

                return (
                    lower_or_equal / len(all_values)
                ) * 100

            # -------------------------------------------------
            # 3. Normalize separately inside each platform
            # -------------------------------------------------

            for post in posts:
                same_platform = [
                    p
                    for p in posts
                    if p["platform"] == post["platform"]
                ]

                reach_values = [
                    p["reach"]
                    for p in same_platform
                ]

                engagement_values = [
                    p["engagement_rate"]
                    for p in same_platform
                ]

                reach_percentile = percentile_score(
                    post["reach"],
                    reach_values,
                )

                engagement_percentile = percentile_score(
                    post["engagement_rate"],
                    engagement_values,
                )

                post["normalized_score"] = (
                    0.30 * reach_percentile
                    + 0.70 * engagement_percentile
                )

            # -------------------------------------------------
            # 4. Average scores if ambassador has multiple posts
            # -------------------------------------------------

            ambassador_scores = {}

            for post in posts:
                ambassador_id = post["ambassador_id"]

                ambassador_scores.setdefault(
                    ambassador_id,
                    []
                ).append(
                    post["normalized_score"]
                )

            final_scores = []

            for ambassador_id, scores in ambassador_scores.items():
                average_score = sum(scores) / len(scores)

                final_scores.append({
                    "ambassador_id": ambassador_id,
                    "score": round(average_score, 2),
                })

            # Highest score first
            final_scores.sort(
                key=lambda x: x["score"],
                reverse=True,
            )

            total = len(final_scores)

            # -------------------------------------------------
            # 5. Calculate rank, percentile and stars
            # -------------------------------------------------

            calculated = []

            for index, item in enumerate(final_scores):
                rank = index + 1

                if total == 1:
                    percentile = 100.0
                else:
                    percentile = (
                        (total - rank)
                        / (total - 1)
                    ) * 100

                if percentile >= 90:
                    stars = 5

                elif percentile >= 70:
                    stars = 4

                else:
                    stars = 3

                calculated.append({
                    "ambassador_id":
                        item["ambassador_id"],

                    "normalized_score":
                        round(item["score"], 2),

                    "percentile_rank":
                        round(percentile, 2),

                    "star_rating":
                        stars,

                    "rank":
                        rank,
                })

            # -------------------------------------------------
            # 6. Save ratings
            # -------------------------------------------------
            conn.execute(
    text("""
        DELETE FROM ambassador_ratings
        WHERE campaign_id = :campaign_id
    """),
    {"campaign_id": campaign_id},
)
            for result in calculated:

                conn.execute(
                    text("""
                        INSERT INTO ambassador_ratings (
                            ambassador_id,
                            campaign_id,
                            normalized_score,
                            percentile_rank,
                            star_rating
                        )

                        VALUES (
                            :ambassador_id,
                            :campaign_id,
                            :normalized_score,
                            :percentile_rank,
                            :star_rating
                        )
                    """),
                    {
                        "ambassador_id":
                            result["ambassador_id"],

                        "campaign_id":
                            campaign_id,

                        "normalized_score":
                            result["normalized_score"],

                        "percentile_rank":
                            result["percentile_rank"],

                        "star_rating":
                            result["star_rating"],
                    },
                )

            log_admin_activity(
                conn,
                current_user,
                "CAMPAIGN_RATINGS_CALCULATED",
                f"Recalculated ratings for '{campaign.title}' ({len(calculated)} ambassador(s)).",
                "campaign",
                campaign_id,
            )

        return {
            "message":
                "Campaign ratings calculated successfully.",

            "campaign_id":
                campaign_id,

            "rated_ambassadors":
                len(calculated),

            "ratings":
                calculated,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate ratings: {e}"
        )

@app.get("/admin/campaigns")
def get_admin_campaigns(
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        c.campaign_id,
                        c.title,
                        c.description,
                        c.mandatory_hashtag,
                        c.target_url,
                        c.start_date,
                        c.end_date,
                        c.is_active,

                        COUNT(
                            DISTINCT cp.ambassador_id
                        ) AS participants,

                        COUNT(
                            DISTINCT cp.post_id
                        ) AS submissions,

                        COUNT(
                            DISTINCT CASE
                                WHEN cp.is_verified = TRUE
                                THEN cp.post_id
                            END
                        ) AS verified

                    FROM campaigns c

                    LEFT JOIN campaign_posts cp
                        ON cp.campaign_id = c.campaign_id

                    GROUP BY
                        c.campaign_id,
                        c.title,
                        c.description,
                        c.mandatory_hashtag,
                        c.target_url,
                        c.start_date,
                        c.end_date,
                        c.is_active

                    ORDER BY
                        c.start_date DESC,
                        c.campaign_id DESC
                """)
            ).fetchall()

            campaigns = []

            for row in rows:
                item = dict(row._mapping)

                today_result = conn.execute(
                    text("SELECT CURRENT_DATE")
                ).scalar()

                if today_result < item["start_date"]:
                    status = "UPCOMING"

                elif today_result > item["end_date"]:
                    status = "COMPLETED"

                elif item["is_active"]:
                    status = "ACTIVE"

                else:
                    status = "COMPLETED"

                item["status"] = status
                item["participants"] = int(
                    item["participants"] or 0
                )
                item["submissions"] = int(
                    item["submissions"] or 0
                )
                item["verified"] = int(
                    item["verified"] or 0
                )

                campaigns.append(item)

        return {
            "campaigns": campaigns
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load campaigns: {e}"
        )
@app.post("/admin/campaigns/preview")
def preview_admin_campaign(
    data: CampaignCreateRequest,
    current_user: dict = Depends(require_admin),
):
    title = data.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="Campaign title is required.")
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date.",
        )
    campaign = {
        "title": title,
        "description": data.description.strip() if data.description else None,
        "mandatory_hashtag": (
            data.mandatory_hashtag.strip()
            if data.mandatory_hashtag
            else None
        ),
        "target_url": data.target_url.strip() if data.target_url else None,
        "start_date": data.start_date,
        "end_date": data.end_date,
    }
    with engine.connect() as conn:
        recipient_count = conn.execute(text("""
            SELECT COUNT(*)::INT FROM users
            WHERE role = 'AMBASSADOR' AND password_hash IS NOT NULL
        """)).scalar_one()
    return {
        "subject": campaign_email_subject(campaign),
        "body": campaign_email_body(
            "Ambassador",
            campaign,
            f"{portal_url()}/ambassador/campaigns/[campaign ID]",
        ),
        "recipient_count": recipient_count,
    }


@app.post("/admin/campaigns")
def create_admin_campaign(
    data: CampaignCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_admin),
):
    try:
        title = data.title.strip()

        if not title:
            raise HTTPException(
                status_code=400,
                detail="Campaign title is required.",
            )

        if data.end_date < data.start_date:
            raise HTTPException(
                status_code=400,
                detail="End date cannot be before start date.",
            )

        with engine.begin() as conn:
            campaign = conn.execute(
                text("""
                    INSERT INTO campaigns (
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active
                    )
                    VALUES (
                        :title,
                        :description,
                        :mandatory_hashtag,
                        :target_url,
                        :start_date,
                        :end_date,
                        :is_active
                    )
                    RETURNING
                        campaign_id,
                        title,
                        description,
                        mandatory_hashtag,
                        target_url,
                        start_date,
                        end_date,
                        is_active
                """),
                {
                    "title": title,
                    "description": (
                        data.description.strip()
                        if data.description
                        else None
                    ),
                    "mandatory_hashtag": (
                        data.mandatory_hashtag.strip()
                        if data.mandatory_hashtag
                        else None
                    ),
                    "target_url": (
                        data.target_url.strip()
                        if data.target_url
                        else None
                    ),
                    "start_date": data.start_date,
                    "end_date": data.end_date,
                    "is_active": data.is_active,
                },
            ).fetchone()

            queued_emails = queue_campaign_notifications(
                conn,
                dict(campaign._mapping),
            )
            log_admin_activity(
                conn,
                current_user,
                "CAMPAIGN_PUBLISHED",
                f"Published '{campaign.title}' and queued {queued_emails} ambassador email(s).",
                "campaign",
                campaign.campaign_id,
            )

        if email_ready() and queued_emails:
            background_tasks.add_task(deliver_pending, engine)

        return {
            "message": "Campaign created successfully.",
            "campaign": dict(campaign._mapping),
            "emails_queued": queued_emails,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create campaign: {e}",
        )
@app.get("/admin/awards")
def get_admin_awards(
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:

            rows = conn.execute(
                text("""
                    WITH latest_ratings AS (
                        SELECT DISTINCT ON (
                            ar.ambassador_id,
                            ar.campaign_id
                        )
                            ar.rating_id,
                            ar.ambassador_id,
                            ar.campaign_id,
                            ar.normalized_score,
                            ar.percentile_rank,
                            ar.star_rating,
                            ar.calculated_at
                        FROM ambassador_ratings ar
                        ORDER BY
                            ar.ambassador_id,
                            ar.campaign_id,
                            ar.calculated_at DESC,
                            ar.rating_id DESC
                    )

                    SELECT
                        lr.ambassador_id,
                        lr.campaign_id,
                        u.full_name,
                        a.college_name,
                        a.status,
                        c.title AS campaign_title,
                        lr.normalized_score,
                        lr.percentile_rank,
                        lr.star_rating,
                        lr.calculated_at

                    FROM latest_ratings lr

                    JOIN ambassadors a
                        ON a.ambassador_id = lr.ambassador_id

                    JOIN users u
                        ON u.user_id = a.user_id

                    JOIN campaigns c
                        ON c.campaign_id = lr.campaign_id

                    WHERE a.status = 'ACTIVE'

                    ORDER BY
                        lr.normalized_score DESC,
                        lr.percentile_rank DESC,
                        u.full_name ASC
                """)
            ).fetchall()

            awards = []

            for index, row in enumerate(rows, start=1):
                item = dict(row._mapping)
                item["rank"] = index
                awards.append(item)

            five_star = sum(
                1 for item in awards
                if item["star_rating"] == 5
            )

            four_star = sum(
                1 for item in awards
                if item["star_rating"] == 4
            )

            three_star = sum(
                1 for item in awards
                if item["star_rating"] == 3
            )

        return {
            "summary": {
                "scoring_eligible": len(awards),
                "five_star": five_star,
                "four_star": four_star,
                "three_star": three_star,
            },
            "awards": awards,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load awards: {e}"
        )
@app.get("/admin/overview")
def get_admin_overview(
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:

            # -------------------------------------------------
            # Main counts
            # -------------------------------------------------

            registered_users = conn.execute(
                text("""
                    SELECT COUNT(*)
                    FROM ambassadors
                """)
            ).scalar() or 0

            active_ambassadors = conn.execute(
                text("""
                    SELECT COUNT(*)
                    FROM ambassadors
                    WHERE status = 'ACTIVE'
                """)
            ).scalar() or 0

            pending_ambassadors = conn.execute(
                text("""
                    SELECT COUNT(*)
                    FROM ambassadors
                    WHERE status = 'PENDING'
                """)
            ).scalar() or 0

            active_campaigns = conn.execute(
                text("""
                    SELECT COUNT(*)
                    FROM campaigns
                    WHERE
                        is_active = TRUE
                        AND CURRENT_DATE BETWEEN start_date AND end_date
                """)
            ).scalar() or 0

            # -------------------------------------------------
            # Post / reach statistics
            # -------------------------------------------------

            post_stats = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (post_id)
                            post_id,
                            reach_count,
                            likes_count,
                            comments_count,
                            shares_count,
                            saves_count,
                            fetched_at
                        FROM metric_snapshots
                        ORDER BY
                            post_id,
                            fetched_at DESC,
                            snapshot_id DESC
                    )

                    SELECT
                        COUNT(
                            DISTINCT CASE
                                WHEN cp.is_verified = TRUE
                                THEN cp.post_id
                            END
                        ) AS verified_posts,

                        COUNT(
                            DISTINCT CASE
                                WHEN cp.is_verified = FALSE
                                THEN cp.post_id
                            END
                        ) AS unverified_posts,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN cp.is_verified = TRUE
                                    THEN ls.reach_count
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS total_reach,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN cp.is_verified = TRUE
                                    THEN
                                        ls.likes_count
                                        + ls.comments_count
                                        + ls.shares_count
                                        + ls.saves_count
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS total_engagements

                    FROM campaign_posts cp

                    LEFT JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id
                """)
            ).fetchone()

            post_stats = dict(post_stats._mapping)

            total_reach = int(
                post_stats["total_reach"] or 0
            )

            total_engagements = int(
                post_stats["total_engagements"] or 0
            )

            verified_posts = int(
                post_stats["verified_posts"] or 0
            )

            unverified_posts = int(
                post_stats["unverified_posts"] or 0
            )

            engagement_rate = (
                round(
                    (total_engagements / total_reach) * 100,
                    2
                )
                if total_reach > 0
                else 0.0
            )

            # -------------------------------------------------
            # Campaigns ending within next 7 days
            # -------------------------------------------------

            ending_soon = conn.execute(
                text("""
                    SELECT COUNT(*)
                    FROM campaigns
                    WHERE
                        is_active = TRUE
                        AND end_date >= CURRENT_DATE
                        AND end_date <= CURRENT_DATE + 7
                """)
            ).scalar() or 0

            notification_stats = conn.execute(
                text("""
                    SELECT
                        COUNT(*) FILTER (
                            WHERE status = 'FAILED'
                        )::INT AS failed_emails,
                        COUNT(*) FILTER (
                            WHERE kind = 'MONTHLY_REPORT'
                              AND status = 'SENT'
                        )::INT AS reports_sent
                    FROM email_outbox
                """)
            ).fetchone()._mapping

            # -------------------------------------------------
            # Recent verified reach activity
            # Latest snapshot per post only
            # -------------------------------------------------

            trend_rows = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.reach_count,
                            ms.fetched_at
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    )

                    SELECT
                        DATE(ls.fetched_at) AS day,
                        COALESCE(
                            SUM(ls.reach_count),
                            0
                        ) AS reach

                    FROM latest_snapshots ls

                    JOIN campaign_posts cp
                        ON cp.post_id = ls.post_id

                    WHERE cp.is_verified = TRUE

                    GROUP BY DATE(ls.fetched_at)

                    ORDER BY day DESC

                    LIMIT 7
                """)
            ).fetchall()

            reach_trend = [
                {
                    "date": str(row._mapping["day"]),
                    "reach": int(
                        row._mapping["reach"] or 0
                    ),
                }
                for row in reversed(trend_rows)
            ]

            # -------------------------------------------------
            # Recent campaign submissions
            # -------------------------------------------------

            submission_rows = conn.execute(
                text("""
                    SELECT
                        u.full_name,
                        cp.platform,
                        c.title AS campaign_title,
                        cp.published_at
                    FROM campaign_posts cp

                    JOIN ambassadors a
                        ON a.ambassador_id = cp.ambassador_id

                    JOIN users u
                        ON u.user_id = a.user_id

                    JOIN campaigns c
                        ON c.campaign_id = cp.campaign_id

                    WHERE cp.published_at IS NOT NULL

                    ORDER BY cp.published_at DESC

                    LIMIT 5
                """)
            ).fetchall()

            recent_activity = []

            for row in submission_rows:
                item = row._mapping

                recent_activity.append({
                    "name": item["full_name"],
                    "action": (
                        f"submitted a {item['platform']} post "
                        f"for {item['campaign_title']}"
                    ),
                    "timestamp": item["published_at"],
                    "type": "SUBMISSION",
                })

            # -------------------------------------------------
            # Recent registrations
            # -------------------------------------------------

            registration_rows = conn.execute(
                text("""
                    SELECT
                        u.full_name,
                        u.created_at,
                        a.status
                    FROM ambassadors a

                    JOIN users u
                        ON u.user_id = a.user_id

                    ORDER BY u.created_at DESC

                    LIMIT 5
                """)
            ).fetchall()

            for row in registration_rows:
                item = row._mapping

                action = (
                    "registered and is awaiting a verified "
                    "social connection"
                    if item["status"] == "PENDING"
                    else "registered as a Campus Ambassador"
                )

                recent_activity.append({
                    "name": item["full_name"],
                    "action": action,
                    "timestamp": item["created_at"],
                    "type": "REGISTRATION",
                })

            recent_activity.sort(
                key=lambda item: item["timestamp"],
                reverse=True,
            )

            recent_activity = recent_activity[:8]

        return {
            "metrics": {
                "registered_users":
                    int(registered_users),

                "active_ambassadors":
                    int(active_ambassadors),

                "pending_ambassadors":
                    int(pending_ambassadors),

                "active_campaigns":
                    int(active_campaigns),

                "verified_posts":
                    verified_posts,

                "unverified_posts":
                    unverified_posts,

                "total_reach":
                    total_reach,

                "total_engagements":
                    total_engagements,

                "engagement_rate":
                    engagement_rate,

                "campaigns_ending_soon":
                    int(ending_soon),

                "pending_verification":
                    unverified_posts,

                "failed_emails":
                    int(notification_stats["failed_emails"] or 0),

                "reports_sent":
                    int(notification_stats["reports_sent"] or 0),
            },

            "reach_trend":
                reach_trend,

            "recent_activity":
                recent_activity,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load admin overview: {e}"
        )

@app.get("/admin/analytics")
def get_admin_analytics(
    current_user: dict = Depends(require_admin),
):
    try:
        with engine.connect() as conn:

            # -------------------------------------------------
            # Latest snapshot per post
            # -------------------------------------------------

            latest_rows = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.reach_count,
                            ms.likes_count,
                            ms.comments_count,
                            ms.shares_count,
                            ms.saves_count,
                            ms.views_impressions,
                            ms.fetched_at
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    )

                    SELECT
                        cp.post_id,
                        cp.ambassador_id,
                        cp.campaign_id,
                        cp.platform,
                        cp.is_verified,
                        c.title AS campaign_title,
                        u.full_name,
                        ls.reach_count,
                        ls.likes_count,
                        ls.comments_count,
                        ls.shares_count,
                        ls.saves_count,
                        ls.views_impressions,
                        ls.fetched_at

                    FROM campaign_posts cp

                    JOIN ambassadors a
                        ON a.ambassador_id = cp.ambassador_id

                    JOIN users u
                        ON u.user_id = a.user_id

                    JOIN campaigns c
                        ON c.campaign_id = cp.campaign_id

                    LEFT JOIN latest_snapshots ls
                        ON ls.post_id = cp.post_id

                    ORDER BY cp.post_id DESC
                """)
            ).fetchall()

            posts = [
                dict(row._mapping)
                for row in latest_rows
            ]

            verified_posts = [
                post
                for post in posts
                if post["is_verified"]
                and post["fetched_at"] is not None
            ]

            total_reach = sum(
                int(post["reach_count"] or 0)
                for post in verified_posts
            )

            total_likes = sum(
                int(post["likes_count"] or 0)
                for post in verified_posts
            )

            total_comments = sum(
                int(post["comments_count"] or 0)
                for post in verified_posts
            )

            total_shares = sum(
                int(post["shares_count"] or 0)
                for post in verified_posts
            )

            total_saves = sum(
                int(post["saves_count"] or 0)
                for post in verified_posts
            )

            total_engagements = (
                total_likes
                + total_comments
                + total_shares
                + total_saves
            )

            engagement_rate = (
                round(
                    (total_engagements / total_reach) * 100,
                    2
                )
                if total_reach > 0
                else 0.0
            )

            # -------------------------------------------------
            # Platform analytics
            # -------------------------------------------------

            platform_map = {}

            for post in verified_posts:
                platform = post["platform"]

                if platform not in platform_map:
                    platform_map[platform] = {
                        "platform": platform,
                        "posts": 0,
                        "reach": 0,
                        "engagements": 0,
                    }

                engagements = (
                    int(post["likes_count"] or 0)
                    + int(post["comments_count"] or 0)
                    + int(post["shares_count"] or 0)
                    + int(post["saves_count"] or 0)
                )

                platform_map[platform]["posts"] += 1
                platform_map[platform]["reach"] += int(
                    post["reach_count"] or 0
                )
                platform_map[platform][
                    "engagements"
                ] += engagements

            platform_performance = []

            for platform in platform_map.values():
                platform["engagement_rate"] = (
                    round(
                        (
                            platform["engagements"]
                            / platform["reach"]
                        )
                        * 100,
                        2,
                    )
                    if platform["reach"] > 0
                    else 0.0
                )

                platform_performance.append(platform)

            platform_performance.sort(
                key=lambda item: item["reach"],
                reverse=True,
            )

            # -------------------------------------------------
            # Campaign analytics
            # -------------------------------------------------

            campaign_map = {}

            for post in posts:
                campaign_id = post["campaign_id"]

                if campaign_id not in campaign_map:
                    campaign_map[campaign_id] = {
                        "campaign_id": campaign_id,
                        "campaign_title":
                            post["campaign_title"],
                        "submissions": 0,
                        "verified_posts": 0,
                        "reach": 0,
                        "engagements": 0,
                    }

                campaign = campaign_map[campaign_id]

                campaign["submissions"] += 1

                if (
                    post["is_verified"]
                    and post["fetched_at"] is not None
                ):
                    campaign["verified_posts"] += 1
                    campaign["reach"] += int(
                        post["reach_count"] or 0
                    )

                    campaign["engagements"] += (
                        int(post["likes_count"] or 0)
                        + int(post["comments_count"] or 0)
                        + int(post["shares_count"] or 0)
                        + int(post["saves_count"] or 0)
                    )

            campaign_performance = []

            for campaign in campaign_map.values():
                campaign["engagement_rate"] = (
                    round(
                        (
                            campaign["engagements"]
                            / campaign["reach"]
                        )
                        * 100,
                        2,
                    )
                    if campaign["reach"] > 0
                    else 0.0
                )

                campaign_performance.append(campaign)

            campaign_performance.sort(
                key=lambda item: item["reach"],
                reverse=True,
            )

            # -------------------------------------------------
            # Top ambassadors by latest verified reach
            # -------------------------------------------------

            ambassador_map = {}

            for post in verified_posts:
                ambassador_id = post["ambassador_id"]

                if ambassador_id not in ambassador_map:
                    ambassador_map[ambassador_id] = {
                        "ambassador_id":
                            ambassador_id,
                        "full_name":
                            post["full_name"],
                        "posts": 0,
                        "reach": 0,
                        "engagements": 0,
                    }

                ambassador = ambassador_map[
                    ambassador_id
                ]

                ambassador["posts"] += 1
                ambassador["reach"] += int(
                    post["reach_count"] or 0
                )

                ambassador["engagements"] += (
                    int(post["likes_count"] or 0)
                    + int(post["comments_count"] or 0)
                    + int(post["shares_count"] or 0)
                    + int(post["saves_count"] or 0)
                )

            top_ambassadors = []

            for ambassador in ambassador_map.values():
                ambassador["engagement_rate"] = (
                    round(
                        (
                            ambassador["engagements"]
                            / ambassador["reach"]
                        )
                        * 100,
                        2,
                    )
                    if ambassador["reach"] > 0
                    else 0.0
                )

                top_ambassadors.append(ambassador)

            top_ambassadors.sort(
                key=lambda item: item["reach"],
                reverse=True,
            )

            # -------------------------------------------------
            # Reach trend by snapshot date
            # -------------------------------------------------

            trend_rows = conn.execute(
                text("""
                    WITH latest_snapshots AS (
                        SELECT DISTINCT ON (ms.post_id)
                            ms.post_id,
                            ms.reach_count,
                            ms.fetched_at
                        FROM metric_snapshots ms
                        ORDER BY
                            ms.post_id,
                            ms.fetched_at DESC,
                            ms.snapshot_id DESC
                    )

                    SELECT
                        DATE(ls.fetched_at) AS day,
                        COALESCE(
                            SUM(ls.reach_count),
                            0
                        ) AS reach

                    FROM latest_snapshots ls

                    JOIN campaign_posts cp
                        ON cp.post_id = ls.post_id

                    WHERE cp.is_verified = TRUE

                    GROUP BY DATE(ls.fetched_at)

                    ORDER BY day ASC
                """)
            ).fetchall()

            reach_trend = [
                {
                    "date": str(
                        row._mapping["day"]
                    ),
                    "reach": int(
                        row._mapping["reach"] or 0
                    ),
                }
                for row in trend_rows
            ]

        return {
            "summary": {
                "verified_posts":
                    len(verified_posts),

                "total_reach":
                    total_reach,

                "total_engagements":
                    total_engagements,

                "engagement_rate":
                    engagement_rate,

                "likes":
                    total_likes,

                "comments":
                    total_comments,

                "shares":
                    total_shares,

                "saves":
                    total_saves,
            },

            "platform_performance":
                platform_performance,

            "campaign_performance":
                campaign_performance,

            "top_ambassadors":
                top_ambassadors[:10],

            "reach_trend":
                reach_trend,
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load analytics: {e}"
        )
