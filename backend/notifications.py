"""Transactional email queue and monthly reach reports for the CiPD portal."""

import os
import smtplib
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


def email_ready() -> bool:
    username = os.getenv("SMTP_USERNAME")
    has_credentials = not username or bool(os.getenv("SMTP_PASSWORD"))
    return (
        email_enabled()
        and bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_FROM"))
        and has_credentials
    )


def queue_welcome_email(conn, user_id: int, full_name: str, invite_url: str) -> bool:
    portal = os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000").rstrip("/")
    body = (
        f"Hello {full_name},\n\n"
        "Welcome to the CiPD Campus Ambassador Programme.\n\n"
        "Your next steps:\n"
        "1. Sign in and complete your profile.\n"
        "2. Join the official ambassador WhatsApp group using this invite link: "
        f"{invite_url}\n"
        "3. Connect a supported social account. Your ambassador status becomes "
        "ACTIVE after at least one account is verified.\n"
        "4. Read each new campaign's official URL, dates, hashtag and guidelines.\n"
        "5. Publish on a connected platform and submit the direct post URL.\n"
        "6. Wait for admin verification of metrics and campaign rating calculation.\n\n"
        f"Step-by-step guide: {portal}/ambassador/guide\n\n"
        "This welcome email is sent once after registration."
    )
    result = conn.execute(text("""
        INSERT INTO email_outbox (user_id, kind, subject, body)
        VALUES (:user_id, 'WELCOME', :subject, :body)
        ON CONFLICT DO NOTHING
        RETURNING message_id
    """), {
        "user_id": user_id,
        "subject": "Welcome to the CiPD Campus Ambassador Programme",
        "body": body,
    }).fetchone()
    return result is not None


def queue_campaign_notifications(conn, campaign: dict) -> int:
    recipients = conn.execute(text("""
        SELECT user_id, full_name FROM users
        WHERE role = 'AMBASSADOR' AND password_hash IS NOT NULL
        ORDER BY user_id
    """)).fetchall()
    portal = os.getenv("PUBLIC_FRONTEND_URL", "http://localhost:3000").rstrip("/")
    subject = f"New CiPD campaign: {campaign['title']}"
    description = campaign.get("description") or "See the campaign brief in the portal."
    official_url = campaign.get("target_url") or "See the campaign page for official content."
    hashtag = campaign.get("mandatory_hashtag") or "No required hashtag"
    queued = 0
    for recipient in recipients:
        body = (
            f"Hello {recipient.full_name},\n\n"
            f"A new CiPD campaign has been listed: {campaign['title']}\n"
            f"Dates: {campaign['start_date']} to {campaign['end_date']}\n"
            f"Official post or content URL: {official_url}\n"
            f"Required hashtag: {hashtag}\n\n"
            f"Campaign guidelines:\n{description}\n\n"
            "Steps: read the full brief, confirm your social account is connected, "
            "publish on a supported platform during campaign dates, include any "
            "required hashtag, and submit the direct post URL in the portal. "
            "An admin will verify your metrics and calculate ratings.\n"
            f"Campaign page: {portal}/ambassador/campaigns/{campaign['campaign_id']}\n\n"
            "You are receiving this because you registered as a CiPD ambassador."
        )
        result = conn.execute(text("""
            INSERT INTO email_outbox (user_id, kind, campaign_id, subject, body)
            VALUES (:user_id, 'CAMPAIGN', :campaign_id, :subject, :body)
            ON CONFLICT DO NOTHING
            RETURNING message_id
        """), {
            "user_id": recipient.user_id,
            "campaign_id": campaign["campaign_id"],
            "subject": subject,
            "body": body,
        }).fetchone()
        queued += int(result is not None)
    return queued


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
        body = (
            f"Hello {row['full_name']},\n\n"
            f"Your CiPD ambassador report for {label}\n"
            f"Reach: {row['reach']:,}\n"
            f"Engagements: {row['engagements']:,}\n"
            f"Verified campaign posts: {row['verified_posts']}\n\n"
            "Your verified metrics by platform:\n"
            f"{format_platform_metrics(row['platform_metrics'])}\n\n"
            "Top 10 normalized leaderboard benchmark:\n"
            f"{benchmark}\n\n"
            "This report counts posts submitted during this calendar month and uses "
            "each post's latest admin-verified cumulative metric snapshot recorded "
            "before month end. The benchmark uses each ambassador's latest stored "
            "normalized campaign rating as of month end; it does not rank raw reach. "
            "Sign in to the CiPD portal for campaign-level details."
        )
        result = conn.execute(text("""
            INSERT INTO email_outbox (user_id, kind, report_month, subject, body)
            VALUES (:user_id, 'MONTHLY_REPORT', :month, :subject, :body)
            ON CONFLICT DO NOTHING
            RETURNING message_id
        """), {
            "user_id": row["user_id"], "month": month,
            "subject": f"Your CiPD ambassador report — {label}", "body": body,
        }).fetchone()
        queued += int(result is not None)
    return queued


def queue_previous_month(engine) -> int:
    with engine.begin() as conn:
        return queue_monthly_reports(conn, previous_month())


def deliver_pending(engine, limit: int = 100) -> dict:
    if not email_ready():
        return {"sent": 0, "failed": 0, "configured": False}
    with engine.begin() as conn:
        jobs = conn.execute(text("""
            WITH claim AS (
                SELECT message_id FROM email_outbox
                WHERE status = 'PENDING'
                   OR (status = 'FAILED' AND attempts < 3
                       AND last_attempt_at < CURRENT_TIMESTAMP - INTERVAL '30 minutes')
                   OR (status = 'SENDING'
                       AND last_attempt_at < CURRENT_TIMESTAMP - INTERVAL '1 hour')
                ORDER BY message_id
                FOR UPDATE SKIP LOCKED
                LIMIT :limit
            )
            UPDATE email_outbox o SET status = 'SENDING',
                attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP
            FROM claim WHERE o.message_id = claim.message_id
            RETURNING o.message_id, o.user_id, o.subject, o.body
        """), {"limit": limit}).fetchall()

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
                        smtp.starttls()
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
