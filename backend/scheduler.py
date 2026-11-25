"""Email delivery and monthly report scheduling for the running API."""

import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler

from notifications import deliver_pending

logger = logging.getLogger(__name__)


def start_scheduler(engine, instagram_sync):
    scheduler = BackgroundScheduler(timezone=ZoneInfo("Asia/Kolkata"))
    scheduler.add_job(
        instagram_sync.prepare_monthly,
        "interval",
        minutes=15,
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
    scheduler.add_job(instagram_sync.run_tick, 'interval', minutes=1,
                      id='instagram_metrics', max_instances=1, coalesce=True)
    # Catch up after downtime without blocking startup; reports wait for fresh data.
    from datetime import datetime, timedelta, timezone
    scheduler.add_job(instagram_sync.prepare_monthly, 'date',
                      run_date=datetime.now(timezone.utc)+timedelta(seconds=10),
                      id='monthly_catchup')
    scheduler.start()
    return scheduler
