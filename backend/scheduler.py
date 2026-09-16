"""Email delivery and monthly report scheduling for the running API."""

import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from notifications import deliver_pending, queue_previous_month

logger = logging.getLogger(__name__)


def start_scheduler(engine):
    scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Kolkata"))
    scheduler.add_job(
        queue_previous_month,
        "cron",
        day=1,
        hour=9,
        minute=0,
        args=[engine],
        id="monthly_reports",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        deliver_pending,
        "interval",
        minutes=5,
        args=[engine],
        id="deliver_email",
        max_instances=1,
        coalesce=True,
    )
    # Catch up after downtime. A unique database key prevents duplicate reports.
    try:
        queue_previous_month(engine)
    except Exception:
        logger.exception("Could not queue the previous month's reports")
    scheduler.start()
    return scheduler
