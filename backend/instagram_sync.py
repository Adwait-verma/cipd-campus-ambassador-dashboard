"""Durable Instagram refresh state, shared budgets and bounded background batches."""
import json
import logging
import os
import random
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from fastapi import Depends, HTTPException
from sqlalchemy import text

log = logging.getLogger(__name__)
INDIA = ZoneInfo('Asia/Kolkata')
SYSTEM = {'user_id': None, 'role': 'SYSTEM'}


def now():
    return datetime.now(timezone.utc)


def positive_setting(name, default, minimum=1):
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def usage_from_headers(headers):
    """Return the largest advertised percentage and recovery delay (seconds)."""
    percentages, delays = [], []

    def visit(value):
        if isinstance(value, dict):
            for key, item in value.items():
                if key in ('call_count', 'total_time', 'total_cputime') and isinstance(item, (int, float)):
                    percentages.append(item)
                elif key == 'estimated_time_to_regain_access' and isinstance(item, (int, float)):
                    delays.append(item * 60)
                else:
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    for name in ('X-App-Usage', 'X-Business-Use-Case-Usage'):
        try:
            visit(json.loads(headers.get(name, '{}')))
        except (ValueError, TypeError):
            pass
    return max(percentages, default=0), max(delays, default=0)


class SyncDeferred(Exception):
    def __init__(self, message, retry_at, status='PAUSED'):
        super().__init__(message)
        self.retry_at, self.status = retry_at, status


class InstagramSync:
    def __init__(self, api):
        self.api = api

    @property
    def engine(self):
        return self.api.engine

    @property
    def interval(self):
        return positive_setting('INSTAGRAM_SYNC_INTERVAL_MINUTES', 60, 15)

    def pause(self, scope, seconds, reason, usage=None):
        until = now() + timedelta(seconds=max(60, seconds))
        with self.engine.begin() as conn:
            conn.execute(text("""INSERT INTO instagram_api_cooldowns(scope,paused_until,usage_percent,reason)
                VALUES(:scope,:until,:usage,:reason) ON CONFLICT(scope) DO UPDATE SET
                paused_until=GREATEST(instagram_api_cooldowns.paused_until,EXCLUDED.paused_until),
                usage_percent=EXCLUDED.usage_percent,reason=EXCLUDED.reason"""),
                dict(scope=scope, until=until, usage=usage, reason=reason))
        return until

    def reserve_call(self, ambassador_id):
        """Count attempted calls, including failed requests; all workers share this ledger."""
        with self.engine.begin() as conn:
            if not conn.execute(text('SELECT pg_try_advisory_xact_lock(826031)')).scalar():
                raise SyncDeferred('Another API request is reserving capacity.', now() + timedelta(seconds=30))
            pause = conn.execute(text("""SELECT MAX(paused_until) FROM instagram_api_cooldowns
                WHERE scope IN ('global',:account) AND paused_until>CURRENT_TIMESTAMP"""), {'account': f'account:{ambassador_id}'}).scalar()
            if pause:
                raise SyncDeferred('Waiting for API rate-limit capacity.', pause)
            counts = conn.execute(text("""SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE ambassador_id=:id) AS account FROM instagram_api_calls
                WHERE called_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'"""), {'id': ambassador_id}).one()
            if counts.total >= positive_setting('INSTAGRAM_API_APP_CALLS_PER_HOUR', 180) or counts.account >= positive_setting('INSTAGRAM_API_ACCOUNT_CALLS_PER_HOUR', 60):
                raise SyncDeferred('Local hourly API safety budget reached.', now() + timedelta(minutes=15))
            last = conn.execute(text('SELECT MAX(called_at) FROM instagram_api_calls')).scalar()
            spacing = positive_setting('INSTAGRAM_API_REQUEST_SPACING_MS', 1000, 100)/1000
            scheduled = max(now(), last+timedelta(seconds=spacing)) if last else now()
            conn.execute(text('INSERT INTO instagram_api_calls(ambassador_id,called_at) VALUES(:id,:at)'), {'id': ambassador_id, 'at': scheduled})
            conn.execute(text("DELETE FROM instagram_api_calls WHERE called_at<CURRENT_TIMESTAMP-INTERVAL '2 days'"))
        return max(0, (scheduled-now()).total_seconds())

    def get(self, ambassador_id, url, **kwargs):
        if urlparse(url).scheme != 'https' or urlparse(url).hostname != 'graph.instagram.com':
            raise SyncDeferred('Unexpected Instagram API pagination host.', now() + timedelta(hours=6), 'FAILED')
        time.sleep(self.reserve_call(ambassador_id))
        try:
            response = requests.get(url, allow_redirects=False, **kwargs)
        except requests.RequestException:
            raise SyncDeferred('Instagram is temporarily unreachable.', now() + timedelta(minutes=5), 'FAILED') from None
        percent, recovery = usage_from_headers(response.headers)
        threshold = min(95, positive_setting('INSTAGRAM_API_USAGE_THRESHOLD_PERCENT', 70))
        if percent >= threshold:
            scope = 'global' if response.headers.get('X-App-Usage') else f'account:{ambassador_id}'
            self.pause(scope, max(recovery, 900), 'Meta usage threshold reached.', percent)
        try:
            error = response.json().get('error', {})
        except (ValueError, AttributeError):
            error = {}
        if response.status_code == 429 or error.get('code') in (4, 17, 32, 613, 80002, 80004):
            retry = response.headers.get('Retry-After', '3600')
            try:
                seconds = float(retry)
            except (ValueError, TypeError):
                try:
                    seconds = (parsedate_to_datetime(retry) - now()).total_seconds()
                except (ValueError, TypeError):
                    seconds = 3600
            until = self.pause('global', max(seconds, recovery, 900), 'Meta throttled API requests.', percent)
            raise SyncDeferred('Instagram rate limit reached; retry scheduled.', until)
        if not response.ok or error:
            reconnect = error.get('code') == 190
            raise SyncDeferred('Reconnect Instagram: token expired or revoked.' if reconnect else 'Instagram rejected this request; check account permissions and post availability.',
                               now() + timedelta(hours=6 if reconnect else 1), 'FAILED')
        return response

    def targets(self, campaign_id=None, month=None):
        with self.engine.connect() as conn:
            return conn.execute(text("""SELECT cp.post_id,cp.campaign_id FROM campaign_posts cp
                JOIN campaigns c USING(campaign_id) JOIN ambassadors a USING(ambassador_id)
                JOIN social_accounts s ON s.ambassador_id=a.ambassador_id AND s.platform='INSTAGRAM'
                WHERE cp.platform='INSTAGRAM' AND a.left_at IS NULL AND a.status='ACTIVE'
                  AND s.verified AND s.access_token IS NOT NULL
                  AND c.finalized_at IS NULL AND c.is_active
                  AND c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
                  AND (:campaign IS NULL OR cp.campaign_id=CAST(:campaign AS INT))
                  AND ((:campaign IS NOT NULL) OR (:month IS NOT NULL AND cp.published_at>=CAST(:month AS DATE)
                       AND cp.published_at<CAST(:month AS DATE)+INTERVAL '1 month')
                       OR (:campaign IS NULL AND :month IS NULL AND c.is_active
                           AND CURRENT_DATE BETWEEN c.start_date AND c.end_date))
                ORDER BY cp.campaign_id,cp.post_id"""), {'campaign': campaign_id, 'month': month}).mappings().all()

    def sync_post(self, post_id, force=False, deadline=None):
        timestamp = now()
        with self.engine.begin() as conn:
            post = conn.execute(text("""SELECT cp.*,a.left_at,c.end_date,c.finalized_at FROM campaign_posts cp
                JOIN ambassadors a USING(ambassador_id) JOIN campaigns c USING(campaign_id)
                WHERE cp.post_id=:id"""), {'id': post_id}).mappings().first()
            if not post or post['platform'] != 'INSTAGRAM' or post['left_at']:
                raise HTTPException(400, 'A current ambassador Instagram submission is required.')
            if post['finalized_at'] or post['end_date'] < now().astimezone(INDIA).date():
                raise HTTPException(409, 'Campaign has ended; its ranking and stored metrics are fixed.')
            state = conn.execute(text("""INSERT INTO instagram_sync_state(post_id,last_attempt_at,lease_until,status)
                VALUES(:id,:now,:lease,'SYNCING') ON CONFLICT(post_id) DO UPDATE SET
                last_attempt_at=:now,lease_until=:lease,status='SYNCING'
                WHERE (instagram_sync_state.lease_until IS NULL OR instagram_sync_state.lease_until<:now)
                  AND (instagram_sync_state.next_attempt_at<=:now OR (:force AND instagram_sync_state.status='SUCCESS'))
                RETURNING failure_count"""), {'id': post_id, 'now': timestamp, 'lease': timestamp+timedelta(minutes=5), 'force': force}).first()
            if not state:
                raise HTTPException(409, 'Sync is already running or a retry cooldown is active.')
        try:
            if not self.api.TOKEN_ENCRYPTION_KEY:
                raise SyncDeferred('Instagram token encryption is not configured on this server.', timestamp+timedelta(hours=6), 'FAILED')
            def getter(url, **kwargs):
                if deadline is not None and time.monotonic() >= deadline:
                    raise SyncDeferred('Batch time budget reached; retry scheduled.', now()+timedelta(minutes=1))
                return self.get(post['ambassador_id'], url, **kwargs)
            with self.engine.begin() as conn:
                token = self.api.get_valid_instagram_token(post['ambassador_id'], conn, http_get=getter)
                media_id = post['platform_post_id'] or ''
                if not media_id.isdigit():
                    media_id = self.api.resolve_instagram_media_id(token, post['post_url'], http_get=getter)
            media = getter(f'https://graph.instagram.com/{media_id}', params={'fields':'like_count,comments_count','access_token':token}, timeout=15).json()
            insights = getter(f'https://graph.instagram.com/{media_id}/insights', params={'metric':'reach,views,saved,shares','access_token':token}, timeout=15).json()
            values = {}
            for item in insights.get('data', []):
                series = item.get('values') or []
                value = series[-1].get('value') if series else item.get('total_value', {}).get('value')
                if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
                    values[item['name']] = value
            required = ('reach', 'views', 'saved', 'shares')
            if not all(key in values for key in required) or not all(isinstance(media.get(k), int) and not isinstance(media.get(k), bool) and media[k] >= 0 for k in ('like_count','comments_count')):
                raise SyncDeferred('Instagram returned incomplete metrics. Last successful values were retained.', timestamp+timedelta(minutes=15), 'FAILED')
            metrics = dict(likes_count=media['like_count'], comments_count=media['comments_count'], shares_count=values['shares'],
                           saves_count=values['saved'], reach_count=values['reach'], views_impressions=values['views'])
            with self.engine.begin() as conn:
                conn.execute(text('SELECT pg_advisory_xact_lock(826033,:id)'), {'id':post['campaign_id']})
                closed = conn.execute(text("""SELECT finalized_at IS NOT NULL OR end_date<
                    (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE FROM campaigns WHERE campaign_id=:id"""), {'id':post['campaign_id']}).scalar()
                if closed:
                    raise SyncDeferred('Campaign has ended; previous metrics and ranking are retained.', now()+timedelta(days=365), 'DISABLED')
                # Recheck exit after network calls, before saving/verification.
                active = conn.execute(text('SELECT left_at FROM ambassadors WHERE ambassador_id=:id FOR UPDATE'), {'id':post['ambassador_id']}).scalar()
                if active:
                    raise SyncDeferred('Ambassador left the programme; sync stopped.', timestamp+timedelta(days=365), 'DISABLED')
                previous = conn.execute(text('SELECT * FROM metric_snapshots WHERE post_id=:id ORDER BY fetched_at DESC,snapshot_id DESC LIMIT 1'), {'id':post_id}).mappings().first()
                changed = not post['is_verified'] or not previous or any(previous[k] != v for k,v in metrics.items())
                params = dict(metrics, post=post_id, day=timestamp.astimezone(INDIA).date())
                snapshot = previous
                if changed:
                    snapshot = conn.execute(text("""INSERT INTO metric_snapshots(post_id,sync_day,likes_count,comments_count,shares_count,saves_count,reach_count,views_impressions)
                    VALUES(:post,:day,:likes_count,:comments_count,:shares_count,:saves_count,:reach_count,:views_impressions)
                    ON CONFLICT(post_id,sync_day) DO UPDATE SET fetched_at=CURRENT_TIMESTAMP,
                    likes_count=EXCLUDED.likes_count,comments_count=EXCLUDED.comments_count,shares_count=EXCLUDED.shares_count,
                    saves_count=EXCLUDED.saves_count,reach_count=EXCLUDED.reach_count,views_impressions=EXCLUDED.views_impressions
                    RETURNING *"""), params).mappings().one()
                conn.execute(text('UPDATE campaign_posts SET platform_post_id=:media,is_verified=TRUE WHERE post_id=:id'), {'media':media_id,'id':post_id})
                conn.execute(text("""UPDATE instagram_sync_state SET status='SUCCESS',last_success_at=:now,
                    next_attempt_at=:next,lease_until=NULL,failure_count=0,last_error=NULL WHERE post_id=:id"""),
                    {'id':post_id,'now':now(),'next':now()+timedelta(minutes=self.interval,seconds=random.randint(0,60))})
            return {'message':'Instagram metrics refreshed; last successful values saved.', 'snapshot':dict(snapshot), 'changed':changed,'campaign_id':post['campaign_id']}
        except Exception as exc:
            if isinstance(exc, SyncDeferred):
                reason, retry, status = str(exc), exc.retry_at, exc.status
            else:
                # Never persist exception strings: requests/SQL exceptions can contain tokens.
                reason = 'Instagram sync failed. Check connection and permissions; previous metrics were retained.'
                retry = now()+timedelta(minutes=min(360, 5 * 2 ** min(state.failure_count,6)))
                status = 'FAILED'
            with self.engine.begin() as conn:
                conn.execute(text("""UPDATE instagram_sync_state SET status=:status,last_error=:reason,
                    next_attempt_at=:retry,lease_until=NULL,failure_count=failure_count+1 WHERE post_id=:id"""),
                    {'id':post_id,'status':status,'reason':reason,'retry':retry})
            raise HTTPException(503, reason) from None

    def refresh_campaign(self, campaign_id, since=None, budget=None, deadline=None):
        since = since or now()-timedelta(minutes=5)
        complete, attempted = True, 0
        for row in self.targets(campaign_id=campaign_id):
            with self.engine.connect() as conn:
                last = conn.execute(text('SELECT last_success_at FROM instagram_sync_state WHERE post_id=:id'), {'id':row['post_id']}).scalar()
            if last and last >= since:
                continue
            if (budget is not None and budget[0] <= 0) or (deadline is not None and time.monotonic() >= deadline):
                complete = False
                continue
            attempted += 1
            if budget is not None:
                budget[0] -= 1
            try:
                self.sync_post(row['post_id'], force=True, deadline=deadline)
            except HTTPException:
                complete = False
        return complete

    def recalculate(self, campaign_id):
        try:
            self.api._calculate_campaign_ratings(campaign_id, SYSTEM)
        except HTTPException as exc:
            if exc.status_code != 400:
                raise

    def run_tick(self):
        self.finalize_due()
        if os.getenv('INSTAGRAM_SYNC_ENABLED','true').lower() != 'true':
            return
        with self.engine.connect() as lock:
            if not lock.execute(text('SELECT pg_try_advisory_lock(826032)')).scalar():
                return
            try:
                changed = set()
                processed = 0
                deadline = time.monotonic()+45
                for row in self.targets():
                    with self.engine.connect() as conn:
                        state = conn.execute(text('SELECT next_attempt_at FROM instagram_sync_state WHERE post_id=:id'), {'id':row['post_id']}).scalar()
                    if state and state > now():
                        continue
                    if processed >= positive_setting('INSTAGRAM_SYNC_BATCH_SIZE',20) or time.monotonic() >= deadline:
                        break
                    processed += 1
                    try:
                        result = self.sync_post(row['post_id'], deadline=deadline)
                        if result['changed']:
                            changed.add(result['campaign_id'])
                    except HTTPException:
                        continue
                # Also recover a batch interrupted after saving metrics but before rating.
                for campaign in changed | self.dirty_campaigns():
                    self.recalculate(campaign)
            finally:
                lock.execute(text('SELECT pg_advisory_unlock(826032)'))

    def prepare_monthly(self):
        # The same database lock prevents overlapping background sync/report batches
        # across reloads and multiple API workers.
        with self.engine.connect() as lock:
            if not lock.execute(text('SELECT pg_try_advisory_lock(826032)')).scalar():
                return
            try:
                self._prepare_monthly()
            finally:
                lock.execute(text('SELECT pg_advisory_unlock(826032)'))

    def _prepare_monthly(self):
        self.finalize_due()
        from notifications import previous_month, queue_monthly_reports
        month = previous_month()
        with self.engine.begin() as conn:
            conn.execute(text('INSERT INTO monthly_sync_runs(report_month) VALUES(:month) ON CONFLICT DO NOTHING'), {'month':month})
            run = conn.execute(text('SELECT * FROM monthly_sync_runs WHERE report_month=:month'), {'month':month}).mappings().one()
        if run['status'] == 'READY':
            return
        complete = True
        budget = [positive_setting('INSTAGRAM_SYNC_BATCH_SIZE',20)]
        deadline = time.monotonic()+45
        campaigns = {r['campaign_id'] for r in self.targets(month=month)} | {r['campaign_id'] for r in self.targets()}
        for campaign in sorted(campaigns):
            if self.refresh_campaign(campaign, since=run['started_at'], budget=budget, deadline=deadline):
                if campaign in self.dirty_campaigns():
                    self.recalculate(campaign)
            else:
                complete = False
        with self.engine.begin() as conn:
            if complete:
                queue_monthly_reports(conn, month)
                conn.execute(text("UPDATE monthly_sync_runs SET status='READY',finished_at=CURRENT_TIMESTAMP,last_error=NULL WHERE report_month=:month"), {'month':month})
            else:
                conn.execute(text("UPDATE monthly_sync_runs SET last_error='Waiting for fresh Instagram metrics or API retry capacity. No reports sent yet.' WHERE report_month=:month"), {'month':month})

    def dirty_campaigns(self):
        with self.engine.connect() as conn:
            return set(conn.execute(text("""SELECT DISTINCT cp.campaign_id FROM campaign_posts cp
                JOIN campaigns c USING(campaign_id) JOIN ambassadors a USING(ambassador_id)
                JOIN metric_snapshots ms USING(post_id) WHERE cp.is_verified
                AND a.left_at IS NULL AND a.status='ACTIVE'
                AND c.finalized_at IS NULL AND c.end_date>=(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE
                AND (c.last_calculated_at IS NULL OR ms.fetched_at>c.last_calculated_at)""")).scalars())

    def finalize_due(self):
        with self.engine.connect() as conn:
            campaigns = conn.execute(text("""SELECT campaign_id FROM campaigns WHERE finalized_at IS NULL
                AND end_date<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE ORDER BY end_date,campaign_id LIMIT 20""")).scalars().all()
        for campaign in campaigns:
            self.recalculate(campaign)

    def finalize_for_member(self, user_id):
        # Preserve an ended result before disconnecting, leaving or rejoining can
        # change the current eligibility used by the final campaign calculation.
        with self.engine.connect() as conn:
            campaigns = conn.execute(text("""SELECT DISTINCT c.campaign_id FROM campaigns c
                JOIN instagram_campaign_posts cp USING(campaign_id) JOIN ambassadors a USING(ambassador_id)
                WHERE a.user_id=:user AND c.finalized_at IS NULL
                AND c.end_date<(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE"""), {'user':user_id}).scalars().all()
        for campaign in campaigns:
            self.recalculate(campaign)


def install_sync(api):
    service = InstagramSync(api)

    @api.app.get('/admin/instagram/sync-status')
    def sync_status(ambassador_id: int | None = None, user=Depends(api.require_admin)):
        with api.engine.connect() as conn:
            rows = conn.execute(text("""SELECT cp.post_id,cp.post_url,cp.campaign_id,a.full_name,
                (a.left_at IS NULL AND a.status='ACTIVE' AND c.is_active AND CURRENT_DATE BETWEEN c.start_date AND c.end_date
                 AND EXISTS(SELECT 1 FROM social_accounts s WHERE s.ambassador_id=a.ambassador_id
                            AND s.platform='INSTAGRAM' AND s.verified AND s.access_token IS NOT NULL)) AS eligible,
                st.last_attempt_at,st.last_success_at,st.next_attempt_at,st.status,st.last_error
                FROM campaign_posts cp JOIN (SELECT a.*,u.full_name FROM ambassadors a JOIN users u USING(user_id)) a USING(ambassador_id)
                JOIN campaigns c USING(campaign_id)
                LEFT JOIN instagram_sync_state st USING(post_id) WHERE cp.platform='INSTAGRAM'
                AND (:id IS NULL OR cp.ambassador_id=CAST(:id AS INT)) ORDER BY cp.post_id DESC LIMIT 200"""), {'id':ambassador_id}).mappings().all()
            cooldowns = conn.execute(text('SELECT * FROM instagram_api_cooldowns WHERE paused_until>CURRENT_TIMESTAMP')).mappings().all()
            reports = conn.execute(text('SELECT * FROM monthly_sync_runs ORDER BY report_month DESC LIMIT 3')).mappings().all()
            calls = conn.execute(text("SELECT COUNT(*) FROM instagram_api_calls WHERE called_at>CURRENT_TIMESTAMP-INTERVAL '1 hour'")).scalar()
        return {'enabled':os.getenv('INSTAGRAM_SYNC_ENABLED','true').lower() == 'true', 'configured':bool(api.TOKEN_ENCRYPTION_KEY),
                'posts':[dict(r) for r in rows], 'cooldowns':[dict(r) for r in cooldowns], 'reports':[dict(r) for r in reports],
                'interval_minutes':service.interval,'calls_last_hour':calls,'local_hourly_budget':positive_setting('INSTAGRAM_API_APP_CALLS_PER_HOUR',180)}

    return service
