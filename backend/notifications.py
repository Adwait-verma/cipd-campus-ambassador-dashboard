"""Transactional email queue and monthly reach reports for the CiPD portal."""

import os
import smtplib
import ssl
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from zoneinfo import ZoneInfo

from sqlalchemy import text

INDIA_TIME = ZoneInfo("Asia/Kolkata")


def previous_month(today: date | None = None) -> date:
    today = today or datetime.now(INDIA_TIME).date()
    return (today.replace(day=1) - timedelta(days=1)).replace(day=1)


def next_month(month: date) -> date:
    return date(month.year + (month.month == 12), month.month % 12 + 1, 1)


def email_enabled() -> bool:
    return os.getenv("EMAIL_DELIVERY_ENABLED", "false").lower() == "true"


def missing_email_settings() -> list[str]:
    required = ["SMTP_HOST", "SMTP_FROM"]
    if os.getenv("SMTP_USERNAME"):
        required.append("SMTP_PASSWORD")
    return [name for name in required if not os.getenv(name)]


def email_ready() -> bool:
    return email_enabled() and not missing_email_settings()


def automatic_email_cutoff() -> datetime | None:
    value = os.getenv("EMAIL_AUTOSEND_AFTER")
    if not value:
        return None
    cutoff = datetime.fromisoformat(value)
    if cutoff.tzinfo is None:
        raise ValueError("EMAIL_AUTOSEND_AFTER must include a timezone offset.")
    return cutoff


def portal_url() -> str:
    return os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000").rstrip("/")


def welcome_email_body(full_name: str, invite_url: str | None) -> str:
    body = (
        f"Hello {full_name},\n\n"
        "Welcome to the CiPD Campus Ambassador Programme! Your account is ready. "
        "You can explore campaigns now; scoring eligibility starts after at least "
        "one social account is verified.\n\n"
        "YOUR NEXT STEPS\n"
        "1. Sign in and complete your ambassador profile.\n"
        "2. Connect a supported social account and complete verification.\n"
        "3. Open a campaign and read its dates, official content URL, "
        "required hashtag and full guidelines.\n"
        "4. Publish your post on a connected platform during the campaign.\n"
        "5. Submit the direct URL of your published post on the campaign page.\n"
        "6. The admin checks the post and records verified metrics, then runs "
        "the campaign rating calculation. Your rank and stars appear in Performance.\n\n"
    )
    if invite_url:
        body += f"OFFICIAL WHATSAPP GROUP\nJoin using the admin-provided invite: {invite_url}\n\n"
    return (
        body
        + f"Step-by-step guide: {portal_url()}/ambassador/guide\n"
        + f"Sign in: {portal_url()}/login\n\n"
        + "CiPD Campus Ambassador Programme"
    )


def queue_welcome_email(conn, user_id: int, full_name: str, invite_url: str | None) -> bool:
    result = conn.execute(text("""
        INSERT INTO email_outbox (user_id, kind, subject, body)
        VALUES (:user_id, 'WELCOME', :subject, :body)
        ON CONFLICT DO NOTHING
        RETURNING message_id
    """), {
        "user_id": user_id,
        "subject": "Welcome to CiPD | Your ambassador next steps",
        "body": welcome_email_body(full_name, invite_url),
    }).fetchone()
    return result is not None


def queue_broadcast(
    conn,
    subject: str,
    message: str,
    invite_url: str | None,
    recipient_user_id: int | None = None,
) -> int:
    broadcast_id = conn.execute(text("""
        INSERT INTO email_broadcasts (subject, body)
        VALUES (:subject, :body)
        RETURNING broadcast_id
    """), {"subject": subject, "body": message}).scalar_one()
    recipients = conn.execute(text("""
        SELECT user_id, full_name FROM users
        WHERE role = 'AMBASSADOR' AND password_hash IS NOT NULL
          AND (:recipient_user_id IS NULL OR user_id = :recipient_user_id)
        ORDER BY user_id
    """), {"recipient_user_id": recipient_user_id}).fetchall()
    for recipient in recipients:
        body = f"Hello {recipient.full_name},\n\n{message}\n\n"
        if invite_url:
            body += f"Official WhatsApp group invite: {invite_url}\n\n"
        body += "This message was sent by a CiPD administrator."
        conn.execute(text("""
            INSERT INTO email_outbox (user_id, kind, broadcast_id, subject, body)
            VALUES (:user_id, 'BROADCAST', :broadcast_id, :subject, :body)
        """), {
            "user_id": recipient.user_id,
            "broadcast_id": broadcast_id,
            "subject": subject,
            "body": body,
        })
    return len(recipients)


def campaign_email_subject(campaign: dict) -> str:
    return f"New CiPD campaign: {campaign['title']}"


def campaign_email_body(
    full_name: str,
    campaign: dict,
    campaign_page_url: str | None = None,
) -> str:
    description = campaign.get("description") or "Read the full campaign brief in the portal."
    official_url = campaign.get("target_url") or "See the campaign page for official content."
    hashtag = campaign.get("mandatory_hashtag") or "None specified"
    page_url = campaign_page_url or (
        f"{portal_url()}/ambassador/campaigns/{campaign['campaign_id']}"
    )
    return (
        f"Hello {full_name},\n\n"
        f"A new CiPD campaign has been listed: {campaign['title']}\n\n"
        "CAMPAIGN DETAILS\n"
        f"Campaign dates: {campaign['start_date']} to {campaign['end_date']}\n"
        f"Official content URL: {official_url}\n"
        f"Required hashtag: {hashtag}\n\n"
        f"BRIEF AND GUIDELINES\n{description}\n\n"
        "WHAT TO DO\n"
        "1. Read the full brief and confirm your social account is connected.\n"
        "2. Publish on a supported platform during the campaign dates, "
        "following the guidelines and required hashtag.\n"
        "3. Submit the direct URL of your published post on the campaign page.\n"
        "4. The admin verifies post metrics and runs the campaign rating calculation.\n\n"
        f"Open campaign: {page_url}\n\n"
        "CiPD Campus Ambassador Programme\n"
        "You received this announcement because you registered as an ambassador."
    )


def queue_campaign_notifications(conn, campaign: dict) -> int:
    recipients = conn.execute(text("""
        SELECT user_id, full_name FROM users
        WHERE role = 'AMBASSADOR' AND password_hash IS NOT NULL
        ORDER BY user_id
    """)).fetchall()
    subject = campaign_email_subject(campaign)
    queued = 0
    for recipient in recipients:
        result = conn.execute(text("""
            INSERT INTO email_outbox (user_id, kind, campaign_id, subject, body)
            VALUES (:user_id, 'CAMPAIGN', :campaign_id, :subject, :body)
            ON CONFLICT DO NOTHING
            RETURNING message_id
        """), {
            "user_id": recipient.user_id,
            "campaign_id": campaign["campaign_id"],
            "subject": subject,
            "body": campaign_email_body(recipient.full_name, campaign),
        }).fetchone()
        queued += int(result is not None)
    return queued


def queue_password_reset_email(
    conn,
    user_id: int,
    full_name: str,
    reset_request_id: int,
    reset_url: str,
) -> bool:
    body = (
        f"Hello {full_name},\n\n"
        "We received a request to reset your CiPD portal password.\n\n"
        f"Reset your password: {reset_url}\n\n"
        "This link expires in 30 minutes and can be used only once. If you did "
        "not request this change, you can ignore this email. Your existing "
        "password remains unchanged.\n\n"
        "CiPD Campus Ambassador Programme"
    )
    result = conn.execute(text("""
        INSERT INTO email_outbox (
            user_id, kind, reset_request_id, subject, body
        )
        VALUES (
            :user_id, 'PASSWORD_RESET', :reset_request_id, :subject, :body
        )
        ON CONFLICT DO NOTHING
        RETURNING message_id
    """), {
        "user_id": user_id,
        "reset_request_id": reset_request_id,
        "subject": "Reset your CiPD portal password",
        "body": body,
    }).fetchone()
    return result is not None


def queue_password_changed_email(
    conn,
    user_id: int,
    full_name: str,
    reset_request_id: int,
) -> bool:
    body = (
        f"Hello {full_name},\n\n"
        "Your CiPD portal password was changed successfully. If you did not "
        "make this change, contact the programme administrator immediately.\n\n"
        f"Sign in: {portal_url()}/login\n\n"
        "CiPD Campus Ambassador Programme"
    )
    result = conn.execute(text("""
        INSERT INTO email_outbox (
            user_id, kind, reset_request_id, subject, body
        )
        VALUES (
            :user_id, 'PASSWORD_CHANGED', :reset_request_id, :subject, :body
        )
        ON CONFLICT DO NOTHING
        RETURNING message_id
    """), {
        "user_id": user_id,
        "reset_request_id": reset_request_id,
        "subject": "Your CiPD portal password was changed",
        "body": body,
    }).fetchone()
    return result is not None


def monthly_metrics(conn, month: date) -> list[dict]:
    """Return monthly verified metrics plus the latest stored normalized rating."""
    rows = conn.execute(text("""
        WITH month_posts AS (
            SELECT cp.post_id, cp.ambassador_id, cp.platform
            FROM campaign_posts cp
            WHERE cp.is_verified = TRUE
              AND cp.published_at >= :month_start
              AND cp.published_at < :month_end
        ), latest_snapshots AS (
            SELECT DISTINCT ON (ms.post_id)
                ms.post_id, ms.reach_count, ms.likes_count,
                ms.comments_count, ms.shares_count, ms.saves_count
            FROM metric_snapshots ms
            JOIN month_posts mp ON mp.post_id = ms.post_id
            WHERE ms.fetched_at < :month_end
            ORDER BY ms.post_id, ms.fetched_at DESC, ms.snapshot_id DESC
        ), latest_ratings AS (
            SELECT DISTINCT ON (ar.ambassador_id)
                ar.ambassador_id,
                ar.normalized_score,
                ar.percentile_rank,
                ar.star_rating
            FROM ambassador_ratings ar
            WHERE ar.calculated_at < :month_end
            ORDER BY ar.ambassador_id, ar.calculated_at DESC, ar.rating_id DESC
        ), ranked_ratings AS (
            SELECT *, RANK() OVER (
                ORDER BY normalized_score DESC
            )::INT AS current_rank
            FROM latest_ratings
        )
        SELECT u.user_id, a.ambassador_id, u.full_name,
            COALESCE(SUM(ls.reach_count), 0)::BIGINT AS reach,
            COALESCE(SUM(ls.likes_count + ls.comments_count + ls.shares_count + ls.saves_count), 0)::BIGINT AS engagements,
            COUNT(ls.post_id)::BIGINT AS verified_posts,
            lr.normalized_score,
            lr.percentile_rank,
            lr.star_rating,
            lr.current_rank
        FROM users u
        JOIN ambassadors a ON a.user_id = u.user_id
        LEFT JOIN month_posts mp ON mp.ambassador_id = a.ambassador_id
        LEFT JOIN latest_snapshots ls ON ls.post_id = mp.post_id
        LEFT JOIN ranked_ratings lr ON lr.ambassador_id = a.ambassador_id
        WHERE u.role = 'AMBASSADOR' AND u.password_hash IS NOT NULL
          AND u.created_at < :month_end
        GROUP BY u.user_id, a.ambassador_id, u.full_name,
            lr.normalized_score, lr.percentile_rank, lr.star_rating,
            lr.current_rank
        ORDER BY lr.current_rank NULLS LAST, u.user_id ASC
    """), {"month_start": month, "month_end": next_month(month)}).fetchall()

    platform_rows = conn.execute(text("""
        WITH month_posts AS (
            SELECT cp.post_id, cp.ambassador_id, cp.platform
            FROM campaign_posts cp
            WHERE cp.is_verified = TRUE
              AND cp.published_at >= :month_start
              AND cp.published_at < :month_end
        ), latest_snapshots AS (
            SELECT DISTINCT ON (ms.post_id)
                ms.post_id, ms.reach_count, ms.likes_count,
                ms.comments_count, ms.shares_count, ms.saves_count
            FROM metric_snapshots ms
            JOIN month_posts mp ON mp.post_id = ms.post_id
            WHERE ms.fetched_at < :month_end
            ORDER BY ms.post_id, ms.fetched_at DESC, ms.snapshot_id DESC
        )
        SELECT mp.ambassador_id, mp.platform,
            COALESCE(SUM(ls.reach_count), 0)::BIGINT AS reach,
            COALESCE(SUM(ls.likes_count), 0)::BIGINT AS likes,
            COALESCE(SUM(ls.comments_count), 0)::BIGINT AS comments,
            COALESCE(SUM(ls.shares_count), 0)::BIGINT AS shares,
            COALESCE(SUM(ls.saves_count), 0)::BIGINT AS saves,
            COUNT(ls.post_id)::BIGINT AS verified_posts
        FROM month_posts mp
        JOIN latest_snapshots ls ON ls.post_id = mp.post_id
        GROUP BY mp.ambassador_id, mp.platform
        ORDER BY mp.ambassador_id, mp.platform
    """), {"month_start": month, "month_end": next_month(month)}).fetchall()

    platforms_by_ambassador: dict[int, list[dict]] = {}
    for platform_row in platform_rows:
        item = dict(platform_row._mapping)
        platforms_by_ambassador.setdefault(item.pop("ambassador_id"), []).append(item)

    result = []
    for row in rows:
        item = dict(row._mapping)
        item["platform_metrics"] = platforms_by_ambassador.get(
            item["ambassador_id"], []
        )
        result.append(item)
    return result


def format_platform_metrics(platforms: list[dict]) -> str:
    if not platforms:
        return "No verified platform metrics were recorded for this month."
    return "\n".join(
        f"- {item['platform'].title()}: {item['reach']:,} reach, "
        f"{item['likes']:,} likes, {item['comments']:,} comments, "
        f"{item['shares']:,} shares, {item['saves']:,} saves, "
        f"{item['verified_posts']} verified post(s)"
        for item in platforms
    )


def monthly_email_body(row: dict, label: str, benchmark: str) -> str:
    if row["normalized_score"] is None:
        rating = "Not calculated yet. A rating appears after verified campaign metrics are calculated."
    else:
        rating = (
            f"Rank: #{row['current_rank']}\n"
            f"Normalized score: {float(row['normalized_score']):.2f}\n"
            f"Percentile: {float(row['percentile_rank']):.2f}%\n"
            f"Star rating: {row['star_rating']} stars"
        )
    return (
        f"Hello {row['full_name']},\n\n"
        f"Here is your CiPD ambassador report for {label}.\n\n"
        "YOUR VERIFIED MONTHLY ACTIVITY\n"
        f"Total reach: {row['reach']:,}\n"
        f"Total engagements: {row['engagements']:,}\n"
        f"Verified campaign posts: {row['verified_posts']}\n\n"
        "BY SOCIAL PLATFORM\n"
        f"{format_platform_metrics(row['platform_metrics'])}\n\n"
        "YOUR LATEST STORED RATING AS OF MONTH END\n"
        f"{rating}\n\n"
        "TOP 10 NORMALIZED LEADERBOARD BENCHMARK\n"
        f"{benchmark}\n\n"
        "Monthly activity uses posts published in this calendar month and their "
        "latest admin-verified cumulative metrics recorded by month end. "
        "Ratings are the latest stored calculations as of month end and may "
        "reflect campaigns outside this month. The top 10 is ordered by "
        "normalized score, not raw reach; platform figures show each leader's "
        "verified activity for this report month.\n\n"
        f"View performance: {portal_url()}/ambassador/performance\n\n"
        "CiPD Campus Ambassador Programme"
    )


def queue_monthly_reports(conn, month: date) -> int:
    if month.day != 1:
        raise ValueError("Report month must be the first day of a month.")
    rows = monthly_metrics(conn, month)
    leaders = [row for row in rows if row["normalized_score"] is not None][:10]
    benchmark = "\n".join(
        f"{row['current_rank']}. {row['full_name']}: normalized score "
        f"{float(row['normalized_score']):.2f}, "
        f"{float(row['percentile_rank']):.2f} percentile, "
        f"{row['star_rating']} stars\n"
        f"{format_platform_metrics(row['platform_metrics'])}"
        for row in leaders
    ) or "No calculated ambassador ratings were available by month end."
    label = month.strftime("%B %Y")
    queued = 0
    for row in rows:
        result = conn.execute(text("""
            INSERT INTO email_outbox (user_id, kind, report_month, subject, body)
            VALUES (:user_id, 'MONTHLY_REPORT', :month, :subject, :body)
            ON CONFLICT DO NOTHING
            RETURNING message_id
        """), {
            "user_id": row["user_id"], "month": month,
            "subject": f"Your CiPD ambassador report | {label}",
            "body": monthly_email_body(row, label, benchmark),
        }).fetchone()
        queued += int(result is not None)
    return queued


def queue_previous_month(engine) -> int:
    with engine.begin() as conn:
        return queue_monthly_reports(conn, previous_month())


def deliver_pending(engine, limit: int = 100, include_older: bool = False) -> dict:
    if not email_ready():
        return {"sent": 0, "failed": 0, "configured": False}
    cutoff = None if include_older else automatic_email_cutoff()
    with engine.begin() as conn:
        jobs = conn.execute(text("""
            WITH claim AS (
                SELECT message_id FROM email_outbox
                WHERE (:cutoff IS NULL OR created_at >= CAST(:cutoff AS TIMESTAMPTZ))
                  AND (status = 'PENDING'
                    OR (status = 'FAILED' AND attempts < 3
                        AND last_attempt_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes')
                    OR (status = 'SENDING'
                        AND last_attempt_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'))
                ORDER BY message_id
                FOR UPDATE SKIP LOCKED
                LIMIT :limit
            )
            UPDATE email_outbox o SET status = 'SENDING',
                attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP
            FROM claim WHERE o.message_id = claim.message_id
            RETURNING o.message_id, o.user_id, o.subject, o.body
        """), {"limit": limit, "cutoff": cutoff}).fetchall()

    sent = failed = 0
    for job in jobs:
        with engine.connect() as conn:
            recipient = conn.execute(text("SELECT email FROM users WHERE user_id = :id"), {"id": job.user_id}).scalar()
        if not recipient:
            failure = "Recipient account no longer exists."
        else:
            try:
                message = EmailMessage()
                message["From"] = os.environ["SMTP_FROM"]
                message["To"] = recipient
                message["Subject"] = job.subject
                message.set_content(job.body)
                host = os.environ["SMTP_HOST"]
                port = int(os.getenv("SMTP_PORT", "587"))
                with smtplib.SMTP(host, port, timeout=20) as smtp:
                    if os.getenv("SMTP_USE_TLS", "true").lower() == "true":
                        smtp.starttls(context=ssl.create_default_context())
                    username = os.getenv("SMTP_USERNAME")
                    if username:
                        smtp.login(username, os.getenv("SMTP_PASSWORD", ""))
                    smtp.send_message(message)
                failure = None
            except Exception as exc:
                failure = type(exc).__name__
        with engine.begin() as conn:
            conn.execute(text("""
                UPDATE email_outbox SET status = :status, last_error = :error,
                    sent_at = CASE WHEN :status = 'SENT' THEN CURRENT_TIMESTAMP ELSE NULL END
                WHERE message_id = :id
            """), {
                "id": job.message_id,
                "status": "FAILED" if failure else "SENT",
                "error": failure,
            })
        if failure:
            failed += 1
        else:
            sent += 1
    return {"sent": sent, "failed": failed, "configured": True}
